require('dotenv').config(); // Lee variables .env (ZOHO_CLIENT_ID, etc.)

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const { calcularComisiones } = require('./public/utils/comisiones');


// Variables globales
let globalItems = null;

let currentAccessToken = null;  // Guardamos el token activo en memoria
let tokenExpiryTime = 0;        // Época (en milisegundos) cuando vence el token

// Lee tus credenciales desde .env o variables de entorno
const {
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN,
    ORG_ID
} = process.env;

let itemWeights = {}; // item_id => weight

// -----------------------------------------------------------------------------
// 1) Función para obtener Access Token válido (renovación con refresh token)
// -----------------------------------------------------------------------------
async function getZohoAccessToken() {
    const now = Date.now();
    // Si el token existe y está vigente, retornarlo
    if (currentAccessToken && now < tokenExpiryTime) {
        return currentAccessToken;
    }

    console.log("Renovando Access Token con refresh_token...");

    const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', ZOHO_CLIENT_ID);
    params.append('client_secret', ZOHO_CLIENT_SECRET);
    params.append('refresh_token', ZOHO_REFRESH_TOKEN);

    try {
        const resp = await fetch(tokenUrl, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        if (!resp.ok) {
            throw new Error(`Error al renovar token: ${resp.status} ${resp.statusText}`);
        }
        const tokenData = await resp.json();
        if (!tokenData.access_token) {
            throw new Error("No se recibió access_token en la respuesta de Zoho");
        }

        currentAccessToken = tokenData.access_token;
        const expiresInSec = parseInt(tokenData.expires_in, 10) || 3600;
        // Resta ~1 minuto para renovarlo un poco antes de que caduque
        tokenExpiryTime = now + (expiresInSec * 1000) - (60 * 1000);

        console.log("Nuevo Access Token obtenido y guardado en memoria.");
        return currentAccessToken;
    } catch (error) {
        console.error("Error renovando token Zoho:", error.message);
        throw error;
    }
}

// -----------------------------------------------------------------------------
// 2) Función para paginar y obtener TODOS los ítems (más de 200) de Zoho Inventory
// -----------------------------------------------------------------------------
async function fetchAllItems(orgId, accessToken) {
    const baseUrl = 'https://www.zohoapis.com/inventory/v1/items';
    let page = 1;
    let hasMore = true;

    const allItems = [];           // ← se sigue devolviendo igual
    const manufacturerMap = new Map(); // ← nuevo diccionario (item_id → fabricante)

    const getManufacturer = (it) => {
        // 1) Campo nativo de Inventory
        let mf = (it.manufacturer || '').toString().trim();
        return mf;
    };

    while (hasMore) {
        const url = `${baseUrl}?organization_id=${orgId}&page=${page}&per_page=200&status=active`;
        console.log(`Llamando a: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error al obtener ítems: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const items = data.items || [];

        // Mantén el array (compatibilidad)
        allItems.push(...items);

        // Construye/actualiza el Map
        for (const it of items) {
            const mf = getManufacturer(it);
            manufacturerMap.set(it.item_id, mf);
        }

        const pc = data.page_context;
        hasMore = pc?.has_more_page === true;
        page++;
    }

    console.log(`Total ítems obtenidos: ${allItems.length}`);

    // ← Adjunta el Map como propiedad sin romper el uso actual
    allItems.manufacturerMap = manufacturerMap;
    return allItems;  // sigue siendo un array
}

// -----------------------------------------------------------------------------
// 3) Cargar los pesos de todos los ítems en el diccionario "itemWeights"
// -----------------------------------------------------------------------------
async function loadItemWeights() {
    const token = await getZohoAccessToken();
    const items = await fetchAllItems(ORG_ID, token);
    // items es un array con { item_id, name, weight, ... }

    const tempMap = {};
    for (let it of items) {
        // Asume que "weight" viene en it.weight, 
        // si fuera un custom field, buscar en it.custom_fields
        tempMap[it.item_id] = it.weight || 0;
    }

    itemWeights = tempMap;
    console.log(`Map itemWeights cargado. Total: ${Object.keys(itemWeights).length} ítems con peso.`);
}
// -----------------------------------------------------------------------------
// 5) Calcular el "peso total" de cada factura usando el diccionario itemWeights
// -----------------------------------------------------------------------------
async function calcInvoiceWeight(invoice) {
    let totalWeight = 0;
    const lineItems = invoice.line_items || [];

    // console.log('Invoice recibida:', invoice);
    // console.log('Line Items:', lineItems);

    for (let li of lineItems) {
        const itemId = li.item_id;
        const quantity = li.quantity || 0;

        // Usar el map global en vez de llamar a la API
        const weightPerUnit = itemWeights[itemId] || 0;
        console.log(`Item ID: ${itemId}, Cantidad: ${quantity}, Peso por unidad: ${weightPerUnit}`);

        totalWeight += (weightPerUnit * quantity);
    }
    console.log(`Peso total calculado: ${totalWeight}`);
    return totalWeight;
}
// -----------------------------------------------------------------------------
// 4) Función para paginar y obtener TODAS las facturas
// -----------------------------------------------------------------------------
async function fetchAllInvoices(orgId, accessToken) {
    const baseUrl = 'https://www.zohoapis.com/inventory/v1/invoices'; // .eu/.in si aplica
    let page = 1;
    let hasMore = true;
    const allInvoices = [];

    while (hasMore) {
        const url = `${baseUrl}?organization_id=${orgId}&page=${page}&per_page=200`;
        console.log(`Llamando a: ${url}`);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Error en Zoho Invoices: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        allInvoices.push(...(data.invoices || []));
        if (data.page_context && data.page_context.has_more_page) {
            page++;
        } else {
            hasMore = false;
        }
    }
    console.log(`Total facturas obtenidas: ${allInvoices.length}`);
    return allInvoices;
}

// -----------------------------------------------------------------------------
//  Función para paginar y obtener los vendedores (salespersons)
// -----------------------------------------------------------------------------
async function fetchAllSalesPersons(orgId, accessToken) {
    if (!orgId || !accessToken) {
        throw new Error('Se requiere orgId y accessToken para obtener facturas');
    }

    const baseUrl = 'https://www.zohoapis.com/books/v3/salespersons';
    const allSalesman = [];

    const url = `${baseUrl}?organization_id=${orgId}`;
    console.log(`Llamando a: ${url}`);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error en Zoho Salespersons: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let salespersonsData = data || [];
    // console.log('%cserver.js:192 object', 'color: #007acc;', salespersonsData);
    allSalesman.push(salespersonsData);

    return allSalesman;
}
// -----------------------------------------------------------------------------
// 5) Función para paginar y obtener TODAS las facturas por vendedor
// -----------------------------------------------------------------------------
async function fetchAllInvoicesBySalesman(orgId, accessToken, salespersonId = null, start = null, end = null, sortCol = 'customer_name', sortOrd = 'A') {
    if (!orgId || !accessToken) {
        throw new Error('Se requiere orgId y accessToken para obtener facturas');
    }

    const baseUrl = 'https://www.zohoapis.com/books/v3/invoices';
    let page = 1;
    let hasMore = true;
    const invoicesSummary = [];

    // 1) LISTA (resumen)
    while (hasMore) {
        const params = new URLSearchParams({
            organization_id: orgId,
            page: String(page),
            per_page: '200',
            detailedlist: 'true',
            sort_column: sortCol,   // 👈 nuevo
            sort_order: sortOrd,     // 👈 nuevo ('A' o 'D')
            status: 'paid' // solo pagadas
            // invoice_type: 'salesinvoice', // opcional, si quieres filtrar por tipo de factura    
        });
        if (salespersonId) params.set('salesperson_id', salespersonId);
        if (start) params.set('date_start', start);
        if (end) params.set('date_end', end);


        const url = `${baseUrl}?${params.toString()}`;
        // console.log('Listando:', url);

        // 1) request
        const info = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });

        // 2) valida HTTP
        if (!info.ok) {
            const text = await info.text();  // útil para ver el JSON de error de Zoho
            throw new Error(`Error Zoho Books ${info.status} ${info.statusText} -> ${text}`);
        }

        // 3) parsea JSON
        const data = await info.json();

        // 4) usa el JSON
        const facturas = data.invoices || [];
        invoicesSummary.push(...facturas);

        hasMore = data.page_context?.has_more_page === true;
        page += 1;
    }

    return invoicesSummary;
}

let mfCache = { map: null, ts: 0 };
async function ensureItemsMap(orgId, accessToken) {
    const now = Date.now();
    if (mfCache.map && (now - mfCache.ts) < 15 * 60 * 1000) return mfCache.map; // 15 min
    const allItems = await fetchAllItems(orgId, accessToken);
    mfCache = { map: allItems.manufacturerMap ?? null, ts: now };
    globalItems = allItems;
    return mfCache.map;
}

// -----------------------------------------------------------------------------
//  Endpoint para devolver TODAS las facturas POR VENDEDOR
// -----------------------------------------------------------------------------
app.get('/api/invoices/comisiones', async (req, res) => {
    try {
        const token = await getZohoAccessToken();
        const spId = req.query.salesperson_id || null;
        const start = req.query.start || null;
        const end = req.query.end || null;
        // lee % del query (en porcentaje humano) y conviértelo a fracción
        let rateVida = parseFloat(req.query.rateVida);
        let rateOtros = parseFloat(req.query.rateOtros);

        // console.log('%cserver.js:306 object', 'color: #007acc;', object);

        rateVida = isNaN(rateVida) ? 8 : rateVida;    // default 8%
        rateOtros = isNaN(rateOtros) ? 5 : rateOtros;   // default 5%
        const rates = {
            vida: rateVida / 100,   // ej. 0.08
            otros: rateOtros / 100,   // ej. 0.05
        };


        console.log('%cserver.js:310 object', 'color: #007acc;', { spId, start, end, rates });

        // 1) Asegura que el mapa de fabricantes esté disponible
        const mfMap = await ensureItemsMap(ORG_ID, token);

        // 2) Trae facturas YA con detalle (detailedlist=true dentro de la función)
        const invoices = await fetchAllInvoicesBySalesman(ORG_ID, token, spId, start, end);

        // 3) Calcula comisiones sin heurística de nombre (usa solo Map o li.manufacturer)
        const { rows, totals } = calcularComisiones(invoices, mfMap, rates);

        // 4) Respuesta
        res.json({ invoices: rows, totals, rates });

    } catch (err) {
        console.error('Error en /api/invoices/comisiones:', err);
        res.status(500).json({ error: 'Error obteniendo facturas con comisiones' });
    }
});
// -----------------------------------------------------------------------------
//  Endpoint para devolver TODAS los VENDEDORES
// -----------------------------------------------------------------------------
app.get('/api/salespersons', async (req, res) => {
    try {
        const token = await getZohoAccessToken();
        const allSalesPersons = await fetchAllSalesPersons(ORG_ID, token);
        // console.log(`Total vendedores: ${allSalesPersons.length}`);
        res.json(allSalesPersons);
    } catch (error) {
        console.error('ERROR /api/invoices/salespersons =>', error.message);
        res.status(500).json({ error: 'Error al obtener vendedores de Zoho Inventory' });
    }
});
// -----------------------------------------------------------------------------
// 6) Endpoint para devolver TODAS las facturas con su peso total
// -----------------------------------------------------------------------------
app.get('/api/invoices', async (req, res) => {
    try {

        const token = await getZohoAccessToken();
        // 2) Traer TODAS las facturas
        const allInvs = await fetchAllInvoices(ORG_ID, token);
        console.log(`Total facturas: ${allInvs.length}`);

        // 3) Calcular peso para cada factura
        const resultado = [];
        for (const inv of allInvs) {
            // const peso = await calcInvoiceWeight(inv);
            resultado.push({
                invoice_number: inv.invoice_number,
                invoice_id: inv.invoice_id,
                date: inv.date,
                status: inv.status,
                // total_weight: peso
            });
        }

        // Retornamos el array final
        res.json(resultado);
    } catch (error) {
        console.error('ERROR /api/invoices =>', error.message);
        res.status(500).json({ error: 'Error al obtener facturas de Zoho Inventory' });
    }
});

// -----------------------------------------------------------------------------
// 7) Endpoint para devolver TODOS los ítems (paginados) a tu front-end (si quieres usarlos allí)
// -----------------------------------------------------------------------------
app.get('/api/items', async (req, res) => {
    try {
        const token = await getZohoAccessToken();
        globalItems = await fetchAllItems(ORG_ID, token);
        res.json(globalItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo datos de Zoho Inventory' });
    }
});

// -----------------------------------------------------------------------------
// 8) Endpoint para devolver las categorías (si lo necesitas en tu front-end)
// -----------------------------------------------------------------------------
app.get('/api/categories', async (req, res) => {
    try {
        const token = await getZohoAccessToken(); // tu lógica para obtener/renovar el token
        const url = `https://www.zohoapis.com/inventory/v1/categories?organization_id=${ORG_ID}`;

        console.log('%cserver.js:139 token', 'color: #007acc;', token);
        const respuesta = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // console.log('%cserver.js:147 respuesta', 'color: #007acc;', respuesta);
        // console.log('Status:', respuesta.status, respuesta.statusText);


        if (!respuesta.ok) {
            const errText = await respuesta.text();
            console.log('Respuesta Zoho con error =>', errText);
            throw new Error(`Error al obtener categorías: ${respuesta.status} ${respuesta.statusText}`);
        }

        const data = await respuesta.json();
        res.json(data.categories || []);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener categorías de Zoho' });
    }
});

// -----------------------------------------------------------------------------
// 9) Función obtener una factura
// -----------------------------------------------------------------------------
async function fetchInvoice(orgId, accessToken, invNumber) {
    try {

        const baseUrl = 'https://www.zohoapis.com/inventory/v1/invoices/'; // .eu/.in si aplica

        const url = `${baseUrl}${invNumber}?organization_id=${orgId}`;
        console.log(`Llamando a: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Error en Zoho Invoice: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        // Validar si la respuesta contiene la factura
        if (!data.invoice) {
            console.error('Factura no encontrada en la respuesta de Zoho.');
            return null;
        }

        return data.invoice;

    } catch (error) {
        console.error(error);
    }
}
// -----------------------------------------------------------------------------
// 10) Endpoint para devolver UNA factura con su peso total
// -----------------------------------------------------------------------------
app.get('/api/invoice/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        if (!invoiceId) {
            return res.status(400).json({ error: 'Se requiere el parámetro search_text' });
        }
        // 1) Verificar si ya cargamos itemWeights
        //    Podrías llamarlo siempre, o tener una condición si itemWeights está vacío
        if (Object.keys(itemWeights).length === 0) {
            console.log('itemWeights vacío; cargando ítems...');
            await loadItemWeights();
        }

        const token = await getZohoAccessToken();
        const invoice = await fetchInvoice(ORG_ID, token, invoiceId);

        if (!invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        // console.log('Factura obtenida:', invoice);
        const peso = await calcInvoiceWeight(invoice);

        // 3) Calcular peso de la factura
        res.json({
            invoice_number: invoice.invoice_number,
            invoice_id: invoice.invoice_id,
            date: invoice.date,
            status: invoice.status,
            total_weight: peso
        });

    } catch (error) {
        console.error('ERROR /api/invoices =>', error.message);
        res.status(500).json({ error: 'Error al obtener facturas de Zoho Inventory' });
    }
});


// 2) rutas de páginas (archivos HTML en /views)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/catalogo', (req, res) => res.sendFile(path.join(__dirname, 'views', 'catalogo.html')));
app.get('/comisiones', (req, res) => res.sendFile(path.join(__dirname, 'views', 'comisiones.html')));
app.get('/facturas', (req, res) => res.sendFile(path.join(__dirname, 'views', 'facturas.html')));
app.get('/products-expire', (req, res) => res.sendFile(path.join(__dirname, 'views', 'productsExpire.html')));

// -----------------------------------------------------------------------------
// Servir la carpeta "public" (HTML, JS, etc.)
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------------------------------
// Iniciar el servidor en el puerto 3000
// -----------------------------------------------------------------------------
const PORT = 3000;
// app.listen(PORT, () => {
//     console.log(`Servidor escuchando en http://localhost:${PORT}`);
// });

if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`⚠️  El puerto ${PORT} ya está en uso.`);
            process.exit(1);
        } else {
            throw err;
        }
    });
}