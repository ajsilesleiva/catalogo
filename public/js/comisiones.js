// === Config ===
const IVA_DEFAULT = 0.15;             // Nicaragua 15%
const VIDA_NAME = 'VIDA';              // fabricante que comisiona 8%
const RATE_VIDA = 0.08;
const RATE_OTHERS = 0.05;
const VIDA_NAME_UP = VIDA_NAME.toUpperCase();

document.addEventListener('DOMContentLoaded', function () {
    // === Helpers UI ===
    const $ = (sel) => document.querySelector(sel);
    const fmt = (n) => (Number(n || 0)).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // refs
    const rateVidaInput = $('#rateVida');
    const rateOtrosInput = $('#rateOtros');
    const txtVida = $('#txtVida');
    const txtOtros = $('#txtOtros');

    // // Convierte a número, admite “8,5” y limita 0–100
    // function parsePct(v, fallback) {
    //     const n = Number(String(v).replace(',', '.'));
    //     if (!Number.isFinite(n)) return fallback;
    //     return Math.min(Math.max(n, 0), 100);
    // }

    function syncHelpText() {
        const vida = rateVidaInput?.value || 8;
        const otros = rateOtrosInput?.value || 5;
        if (rateVidaInput) rateVidaInput.value = vida;
        if (rateOtrosInput) rateOtrosInput.value = otros;
        if (txtVida) txtVida.textContent = `${vida}%`;
        if (txtOtros) txtOtros.textContent = `${otros}%`;

        // Si necesitas recalcular la tabla cuando cambien:
        // recalcularComisiones(vida/100, otros/100);
    }

    // Escuchar cambios
    rateVidaInput?.addEventListener('input', syncHelpText);
    rateOtrosInput?.addEventListener('input', syncHelpText);

    // Sincroniza al cargar
    syncHelpText();


    // === Carga inicial de vendedores (opcional) ===
    async function loadSalespersons() {
        const sel = $('#salesperson');
        sel.innerHTML = '<option value="">— seleccionar —</option>';
        try {
            // Ajusta la ruta a tu backend. Debe devolver: { salespersons:[ {salesperson_id, name}, ...] }
            const res = await fetch('/api/salespersons');
            if (!res.ok) throw new Error('no sellers');
            const data = await res.json();
            for (const sp of (data[0].data || [])) {
                const opt = document.createElement('option');
                opt.value = sp.salesperson_id;
                opt.textContent = `${sp.salesperson_name}`;
                sel.appendChild(opt);
            }
        } catch (err) { /* silencioso: permite input manual */ }
    }

    // === Fetch de facturas ===
    async function fetchInvoices({ salespersonId, start, end, rateVida, rateOtros }) {
        // Ajusta a tu backend. Recomendado: proxy que llama a Zoho y ya enriquece cada línea con "manufacturer".
        // Debe responder: { invoices: [ { invoice_id, invoice_number, date, customer_name, is_inclusive_tax, line_items:[{quantity, rate, discount, discount_amount, tax_percentage, manufacturer}], payments:[{date, amount}] } ] }
        const url = new URL('/api/invoices/comisiones', window.location.origin);
        if (salespersonId) url.searchParams.set('salesperson_id', salespersonId);
        if (start) url.searchParams.set('start', start);
        if (end) url.searchParams.set('end', end);
        if (rateVida) url.searchParams.set('rateVida', rateVida);
        if (rateOtros) url.searchParams.set('rateOtros', rateOtros);
        // lee % del query (en porcentaje humano) y conviértelo a fracción
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Error consultando backend');
        return res.json();
    }

    // ---------------- Utils para el frontend ----------------
    function getBadge(r) {
        if (r.com_total === 0 && r.base_vida === 0 && r.base_otros === 0) {
            if (r.status === 'voided') return 'ANULADA';
            if (r.status === 'credited') return 'DEVOLUCIÓN';
            return 'BONIFICACIÓN';
        }
        return null;
    }
    function renderRows(rows) {
        const tbody = $('#tabla tbody');
        tbody.innerHTML = '';
        let tBV = 0, tCV = 0, tBO = 0, tCO = 0, tCT = 0;
        let tQtyV = 0, tQtyO = 0;

        for (const r of rows) {
            const tr = document.createElement('tr');
            const badge = getBadge ? getBadge(r) : null; // por si usas los badges

            if (badge) tr.classList.add('bonificacion');

            tr.innerHTML = `
      <td>
        ${r.invoice_number}
        ${badge ? '<span class="badge-bonificacion" title="Factura bonificada: sin base y sin comisión">BONIFICACIÓN</span>' : ''}
      </td>
      <td>${r.customer_name}</td>
      <td>${r.date || ''}</td>
      <td>${r.paid_date || ''}</td>
      <td class="right">${Number(r.qty_vida || 0)}</td>        <!-- 👈 nuevo -->
      <td class="right">${Number(r.qty_otros || 0)}</td>       <!-- 👈 nuevo -->
      <td class="right">${fmt(r.base_vida)}</td>
      <td class="right">${fmt(r.com_vida)}</td>
      <td class="right">${fmt(r.base_otros)}</td>
      <td class="right">${fmt(r.com_otros)}</td>
      <td class="right">${fmt(r.com_total)}</td>
    `;
            tbody.appendChild(tr);

            // Acumular totales igual (suma 0 para bonificadas, no afecta)
            tQtyV += Number(r.qty_vida || 0);
            tQtyO += Number(r.qty_otros || 0);
            tBV += r.base_vida;
            tCV += r.com_vida;
            tBO += r.base_otros;
            tCO += r.com_otros;
            tCT += r.com_total;
        }

        const totalSinIVA = tBV + tBO;
        // const totalConIVA = totalSinIVA * 1.15;
        const ventaTotal = totalSinIVA || 0;
        const promedioFactura = totalSinIVA / rows.length || 0;
        const pctVida = (tBV / totalSinIVA) * 100;
        const pctOtros = (tBO / totalSinIVA) * 100;
        $('#ventaTotal').textContent = ventaTotal.toFixed(2);
        $('#promedioFactura').textContent = promedioFactura.toFixed(2);
        $('#pctVida').textContent = pctVida.toFixed(1) + '%';
        $('#pctOtros').textContent = pctOtros.toFixed(1) + '%';

        $('#tQtyVida').textContent = tQtyV.toLocaleString();
        $('#tQtyOtros').textContent = tQtyO.toLocaleString();
        $('#tBaseVida').textContent = fmt(tBV);
        $('#tComVida').textContent = fmt(tCV);
        $('#tBaseOtros').textContent = fmt(tBO);
        $('#tComOtros').textContent = fmt(tCO);
        $('#tComTotal').textContent = fmt(tCT);
    }

    function toCSV(rows) {
        const header = ['Factura', 'Cliente', 'Fecha factura', 'Fecha pago', 'Base VIDA', '8% VIDA', 'Base Otros', '5% Otros', 'Comisión total'];
        const lines = [header.join(',')];
        rows.forEach(r => {
            lines.push([
                r.invoice_number,
                '"' + (r.customer_name || '').replaceAll('"', '""') + '"',
                r.date || '', r.paid_date || '',
                r.baseVida, r.comVida, r.baseOtros, r.comOtros, r.comTotal
            ].join(','));
        });
        return lines.join('\n');
    }

    // === Eventos ===
    $('#btnBuscarFactura').addEventListener('click', async () => {
        const spSel = $('#salesperson').value.trim();
        const spTxt = $('#salespersonId').value.trim();
        const salespersonId = spSel || spTxt;
        const start = $('#start').value;
        const end = $('#end').value;
        const rateVida = Number(rateVidaInput.value || 0);   // porcentaje
        const rateOtros = Number(rateOtrosInput.value || 0);  // porcentaje

        $('#badgePeriodo').textContent = start && end ? `Periodo: ${start} → ${end}` : 'Periodo: (sin filtro)';
        $('#badgeVendedor').textContent = salespersonId ? `Vendedor: ${salespersonId}` : 'Vendedor: (todos)';
        $('#badgeInfo').classList.remove('hidden');
        $('#badgeInfo').textContent = 'Consultando…';

        try {
            const data = await fetchInvoices({ salespersonId, start, end, rateVida, rateOtros });
            const rows = (data.invoices || []);
            renderRows(rows);
            $('#badgeInfo').textContent = `${rows.length} factura(s)`;
        } catch (err) {
            $('#badgeInfo').textContent = 'Error consultando backend';
            $('#badgeInfo').classList.add('warn');
            console.error(err);
        }
    });

    $('#btnCSV').addEventListener('click', () => {
        const rows = [...document.querySelectorAll('#tabla tbody tr')].map(tr => {
            const t = tr.querySelectorAll('td');
            const num = s => Number((s || '0').replace(/,/g, ''));
            return {
                factura: t[0]?.textContent || '',
                cliente: t[1]?.textContent || '',
                fecha: t[2]?.textContent || '',
                pago: t[3]?.textContent || '',
                unid_vida: num(t[4]?.textContent),
                unid_otros: num(t[5]?.textContent),
                base_vida: num(t[6]?.textContent),
                com_vida: num(t[7]?.textContent),
                base_otros: num(t[8]?.textContent),
                com_otros: num(t[9]?.textContent),
                com_total: num(t[10]?.textContent),
            };
        });
        const headers = Object.keys(rows[0] || {});
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Comisiones de ${$('#salesperson').selectedOptions[0]?.textContent ?? 'vendedor AjSiles'}.csv`;
        a.click();
    });

    const tabla = document.getElementById('tabla');
    const tbody = tabla.querySelector('tbody');
    const thFactura = tabla.querySelector('thead th:nth-child(1)');
    const thCliente = tabla.querySelector('thead th:nth-child(2)');

    // Alterna dirección por columna
    const sortState = { factura: 1, cliente: 1 };
    const coll = new Intl.Collator('es', { sensitivity: 'base' });

    function getFacturaNum(cell) {
        // Extrae el número de la factura, ej: FACT-000551 -> 551
        const match = cell.innerText.match(/\d+/);
        return match ? parseInt(match[0], 10) : -Infinity;
    }
    // Ordena por número de factura
    function sortByFactura() {
        const dir = sortState.factura = -sortState.factura;
        const rows = Array.from(tbody.rows).map((r, i) => ({
            r,
            i,
            key: getFacturaNum(r.cells[0]) // 👈 usa la extracción numérica
        }));
        rows.sort((a, b) => (a.key - b.key) * dir || (a.i - b.i));
        tbody.append(...rows.map(x => x.r));
    }
        // Ordena por nombre de cliente
    function sortByCliente() {
        const dir = sortState.cliente = -sortState.cliente;
        const rows = Array.from(tbody.rows).map((r, i) => ({
            r, i, key: r.cells[1].innerText.trim()
        }));
        rows.sort((a, b) => coll.compare(a.key, b.key) * dir || (a.i - b.i));
        tbody.append(...rows.map(x => x.r));
    }

    thFactura.style.cursor = 'pointer';
    thCliente.style.cursor = 'pointer';
    thFactura.addEventListener('click', sortByFactura);
    thCliente.addEventListener('click', sortByCliente);

    // Carga inicial de vendedores (si tu backend lo soporta)
    loadSalespersons();

})