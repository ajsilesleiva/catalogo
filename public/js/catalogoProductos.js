let productosValidos = []; // Variable global para almacenar productos con imágenes en base64
let productosMostrados = [];
let proveedoresSeleccionados = [];
let allCategories = [];     // Arreglo global para guardar todas las categorías de Zoho


document.addEventListener('DOMContentLoaded', function () {
    const botonVisualizar = document.getElementById('btnVisualizar');
    // const botonDescargar = document.getElementById('btnDescargar');
    const selectorCategoriaPrincipal = document.getElementById('selectorCategoriaPrincipal');
    const selectorSubcategoria = document.getElementById('selectorSubcategoria');
    const selectorOrden = document.getElementById('selectorOrden');
    const inputCantidadMinima = document.getElementById('inputCantidadMinima');

    // Deshabilitar botones inicialmente
    botonVisualizar.disabled = true;
    // botonDescargar.disabled = true;

    // 1) Cargar categorías para poder obtener la categoría padre y subcategorías
    fetch('/api/categories')
        .then(resp => {
            if (!resp.ok) throw new Error('Error al obtener /api/categories');
            return resp.json();
        })
        .then(categoriesData => {
            // Guardamos la lista de categorías en una variable global
            // Ej: [{ category_id, category_name, parent_category_id, parent_category_name, is_subcategory }, ...]
            allCategories = categoriesData || [];
            // console.log('Categorías Zoho =>', allCategories);

            // 2) Llamar a /api/items para obtener los ítems
            return fetch('/api/items');
        })
        .then(resp => {
            if (!resp.ok) throw new Error('Error al obtener /api/items');
            return resp.json();
        })
        .then(itemsZoho => {
            // console.log('Items Zoho =>', itemsZoho);

            // 3) Mapear cada item, cruzando con allCategories
            productosValidos = itemsZoho.map(item => {
                // Ej: item.category_id = "5467547000000924001"
                const catId = item.category_id;
                const catObj = allCategories.find(c => c.category_id === catId);

                // Determinar "catPrincipal" y "subcat" con la lógica:
                // - Si catObj.depth = 0 => es categoría principal
                // - Si catObj.depth > 0 => es subcategoría => buscar la categoría padre
                let catPrincipal = '';
                let subcat = '';

                if (catObj) {
                    if (catObj.depth === 0) {
                        // Es categoría principal
                        catPrincipal = catObj.name; // la "raíz"
                        subcat = '';
                    } else {
                        // Es subcategoría (depth >= 1)
                        // Buscar la categoría padre en allCategories
                        const parentCat = allCategories.find(pc => pc.category_id === catObj.parent_category_id);
                        if (parentCat) {
                            catPrincipal = parentCat.name; // la categoría padre
                            subcat = catObj.name;          // la subcategoría
                        } else {
                            // Si no encontramos el padre, interpretamos el catObj como principal
                            catPrincipal = catObj.name;
                            subcat = '';
                        }
                    }
                }

                // Calcular existencias
                let existencias = 0;
                if (item.stock_on_hand !== undefined) {
                    existencias = parseInt(item.stock_on_hand, 10);
                }

                return {
                    SKU: item.sku,
                    Nombre: item.name,
                    Costo: item.purchase_rate,
                    Precio: item.rate,
                    Status: item.status,
                    Proveedor: item.manufacturer || '',
                    CategoriaPrincipal: catPrincipal,
                    Subcategoria: subcat,
                    UnidadMedida: item.cf_unidad_de_medida,
                    Existencias: existencias,
                    fechaVencimiento: item.cf_fecha_de_vencimiento,
                    Peso: item.weight
                };
            });

            // console.log('Productos con catPrincipal y subcat =>', productosValidos);

            // 4) Filtrar (solo activos, proveedores, etc.)
            productosValidos = productosValidos.filter(producto => {
                const proveedorLower = producto.Proveedor.trim().toLowerCase();
                const statusLower = producto.Status ? producto.Status.trim().toLowerCase() : '';
                return (
                    producto.SKU &&
                    producto.Nombre &&
                    producto.Precio &&
                    producto.Status &&
                    proveedorLower !== 'ushas' &&
                    proveedorLower !== 'ajsiles' &&
                    statusLower === 'active'
                );
            });

            // console.log('productosValidos filtrados =>', productosValidos);

            // 5) Poblar selectores y bind de eventos (igual que antes)
            poblarSelectorCategorias(productosValidos);

            // Eventos
            selectorCategoriaPrincipal.addEventListener('change', function () {
                const categoriaSeleccionada = selectorCategoriaPrincipal.value;
                if (categoriaSeleccionada) {
                    actualizarSubcategorias(categoriaSeleccionada);
                } else {
                    selectorSubcategoria.innerHTML = '';
                }
                const cantidadMinima = parseInt(inputCantidadMinima.value, 10) || 12;
                filtrosSecundarios(cantidadMinima);
            });

            selectorSubcategoria.addEventListener('change', function () {
                const cantidadMinima = parseInt(inputCantidadMinima.value, 10) || 12;
                filtrosSecundarios(cantidadMinima);
            });

            selectorOrden.addEventListener('change', function () {
                const cantidadMinima = parseInt(inputCantidadMinima.value, 10) || 12;
                filtrosSecundarios(cantidadMinima);
            });

            inputCantidadMinima.addEventListener('input', function () {
                const cantidadMinima = parseInt(inputCantidadMinima.value, 10) || 12;
                filtrosSecundarios(cantidadMinima);
            });

            // document.getElementById('selectorCliente').addEventListener('change', function () {
            //     const cantidadMinima = parseInt(inputCantidadMinima.value, 10) || 12;
            //     filtrosSecundarios(cantidadMinima);
            // });

            document.getElementById('filtroProveedores').addEventListener('change', function () {
                const cantidadMinima = parseInt(inputCantidadMinima.value, 10) || 12;
                filtrosSecundarios(cantidadMinima);
            });

            // Filtro inicial
            filtrosSecundarios(12);

        })
        .catch(err => {
            console.error('Error:', err);
            alert('Hubo un error al cargar las categorías o los productos desde Zoho');
        });
});

function poblarSelectorCategorias(productos) {
    const selectorCategoriaPrincipal = document.getElementById('selectorCategoriaPrincipal');
    // Limpia el contenido previo del selector (opcional si lo necesitas)
    selectorCategoriaPrincipal.innerHTML = '';

    // Agrega opción "Todos" como primera opción
    const optionTodos = document.createElement('option');
    optionTodos.value = '';
    optionTodos.textContent = 'Todos';
    selectorCategoriaPrincipal.appendChild(optionTodos);

    const categoriasPrincipales = [...new Set(productos.map(p => p['CategoriaPrincipal']))];
    categoriasPrincipales.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        selectorCategoriaPrincipal.appendChild(option);
    });
}

function actualizarSubcategorias(categoriaPrincipal) {
    const selectorSubcategoria = document.getElementById('selectorSubcategoria');
    selectorSubcategoria.innerHTML = '';

    const subcategorias = [...new Set(productosValidos
        .filter(p => p['CategoriaPrincipal'] === categoriaPrincipal)
        .map(p => p['Subcategoria']))];

    const optionTodos = document.createElement('option');
    optionTodos.value = '';
    optionTodos.textContent = 'Ver todos';
    selectorSubcategoria.appendChild(optionTodos);

    subcategorias.forEach(subcategoria => {
        const option = document.createElement('option');
        option.value = subcategoria;
        option.textContent = subcategoria;
        selectorSubcategoria.appendChild(option);
    });

}

function filtrosSecundarios(cantidadMinima) {
    const categoriaSeleccionada = document.getElementById('selectorCategoriaPrincipal').value;
    const subcategoriasSeleccionadas = Array.from(selectorSubcategoria.selectedOptions)
        .map(option => option.value.trim().toLowerCase());
    const ordenSeleccionado = selectorOrden.value;
    const checkboxes = document.querySelectorAll('#filtroProveedores input[type="checkbox"]');
    proveedoresSeleccionados = Array.from(checkboxes)
        .filter(checkbox => checkbox.checked && checkbox.value !== 'todos')
        .map(checkbox => checkbox.value.trim().toLowerCase());


    // 1) Iniciar con todos los productos válidos o con los filtrados por categoría
    let productosFiltrados = [];

    if (categoriaSeleccionada) {
        // Filtramos por existencias >= cantidadMinima y categoría principal
        productosFiltrados = productosValidos.filter(producto => {
            const existeSuficiente = parseInt(producto.Existencias, 10) >= cantidadMinima;
            const coincideCategoria = producto['CategoriaPrincipal'] === categoriaSeleccionada;
            return existeSuficiente && coincideCategoria;
        });
    } else {
        // Si no hay categoría seleccionada, podrías:
        // - Mostrar todos los productos con existencias >= cantidadMinima
        // - O bien no mostrar nada. Depende de tu lógica.
        productosFiltrados = productosValidos.filter(producto => {
            return parseInt(producto.Existencias, 10) >= cantidadMinima;
        });
    }

    // console.log(categoriaSeleccionada, '1')
    // console.log(productosFiltrados, '1')

    // 2) Filtrar por subcategoría (solo si no se seleccionó "" y hay algo distinto de "")
    if (subcategoriasSeleccionadas.length > 0 && !subcategoriasSeleccionadas.includes("")) {
        // Aquí comparas con el valor real del CSV (ojo con mayúsculas/minúsculas)
        productosFiltrados = productosFiltrados.filter(producto =>
            subcategoriasSeleccionadas.includes(
                String(producto['Subcategoria']).trim().toLowerCase()
            )
        );
    }

    // console.log(subcategoriasSeleccionadas, '2')
    // console.log(productosFiltrados, '2')

    // 3) Filtrar por proveedores (si se seleccionaron en el checkbox)
    if (proveedoresSeleccionados.length > 0) {
        // Asegúrate de normalizar minúsculas
        productosFiltrados = productosFiltrados.filter(producto =>
            proveedoresSeleccionados.includes(
                String(producto['Proveedor']).trim().toLowerCase()
            )
        );
    }

    // console.log(proveedoresSeleccionados, '3')
    // console.log(productosFiltrados, '3')

    // 4) Ordenar asc/desc
    if (ordenSeleccionado === 'asc' || ordenSeleccionado === 'desc') {
        productosFiltrados.sort((a, b) => {
            const nombreA = a.Nombre ? a.Nombre.toLowerCase() : '';
            const nombreB = b.Nombre ? b.Nombre.toLowerCase() : '';

            if (ordenSeleccionado === 'asc') {
                return nombreA.localeCompare(nombreB);
            } else {
                return nombreB.localeCompare(nombreA);
            }
        });
    }

    // 5) Finalmente, mostrar el resultado
    //    Muestra los productos aunque sea un array vacío (para "borrar" la pantalla
    //    si no hay nada que coincida), o puedes hacer un condicional
    mostrarProductos(productosFiltrados);
}

async function mostrarProductos(productos) {
    const catalogo = document.getElementById('catalogo');
    catalogo.innerHTML = '';

    // const tipoCliente = document.getElementById('selectorCliente').value; // Obtener el tipo de cliente
    productosMostrados = productos;

    await Promise.all(
        productos.map(async producto => {
            try {
                const div = document.createElement('div');
                div.classList.add('producto');

                const skuEncoded = producto.SKU.replace('#', '%23');
                const noImage = `Fotos/no-image.svg`;
                const urlImagenJpg = `Fotos/${skuEncoded}.jpg`;

                // Calcular precio base
                const precioBase = parseFloat(producto.Precio);
                let precioAjustado = precioBase;
                const precioajustadoMinorista = Math.round((precioBase * 0.15) + precioBase);
                const precioajustadoDocena = Math.round((precioBase * 0.25) + precioBase);
                let cambioRealizado = false;

                // switch (tipoCliente) {
                //     case 'minorista':
                //         // Calcular el precio con un 15% adicional
                //         const precioMinorista = Math.round((precioBase * 0.15) + precioBase);
                //         precioAjustado = precioMinorista;
                //         precioajustadoMinorista = precioMinorista;
                //         break;

                //     case 'xdocena':
                //         // Calcular el precio X docena con un 25% adicional
                //         const precioDocena = Math.round((precioBase * 0.25) + precioBase);
                //         precioAjustado = precioDocena;
                //         precioajustadoDocena = precioDocena;
                //         break;
                // }

                div.innerHTML = `
                    <img src="${urlImagenJpg}" alt="${producto.Nombre}" loading="lazy" id="img-${producto.SKU}" 
                         onerror="this.onerror=null;this.src='${noImage}';">
                    <h5 class="text-truncate">${producto.Nombre}</h5>
                    <p class="unidadmedida" style="text-align: left">Unidad de medida: <b>${producto.UnidadMedida}</b></p>
                    <p class="existencias" style="text-align: left; display: none;">Existencias: <b>${producto.Existencias}</b></p>
                       <p class="sku">SKU: ${producto.SKU}</p>
                    <div class="price-container">
                            <div class="price-tag"><b>Distrib.</b> <br> C$ ${precioAjustado}</div>
                            <div class="price-tag"><b>Mayorist</b> <br> C$ ${precioajustadoMinorista}</div>
                            <div class="price-tag"><b>Docena</b> <br> C$ ${precioajustadoDocena}</div>
                    </div>
                    </p>
                `;
                catalogo.appendChild(div);
            } catch (err) {
                // console.log(err)
                console.warn(`Producto omitido: ${producto.SKU}`);
            }
        })
    );

    const botonVisualizar = document.getElementById('btnVisualizar');
    // const botonDescargar = document.getElementById('btnDescargar');
    botonVisualizar.disabled = false;
    // botonDescargar.disabled = false;
}

async function previsualizarPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    let y = 5;

    // const tipoCliente = document.getElementById('selectorCliente').value; // Obtener tipo de cliente

    // Obtener la categoría principal seleccionada
    const categoriaSeleccionada = document.getElementById('selectorCategoriaPrincipal').value || "";

    // Obtener la subcategoría seleccionada
    const subcategoriaSeleccionada = document.getElementById('selectorSubcategoria').value || "";

    // Limpiar texto para evitar caracteres no válidos
    const categoriaLimpia = limpiarTextoParaArchivo(categoriaSeleccionada);
    const fechaActual = new Date().toISOString().split('T')[0]; // Fecha en formato YYYY-MM-DD
    const nombreArchivo = `${categoriaLimpia}_${fechaActual}.pdf`;

    // Agregar la portada con la categoría y subcategoría
    agregarPortada(pdf, categoriaSeleccionada, subcategoriaSeleccionada);

    // Añadir una nueva página para los productos
    pdf.addPage();

    pdf.setFontSize(10);

    let x = 5;
    const anchoImagen = 46;
    const altoImagen = 50;
    const espacioHorizontal = 55;
    const espacioVertical = 90;
    const itemsPorFila = 4;
    let itemActual = 0;

    for (const producto of productosMostrados) {

        // Calcular precio base
        const precioBase = parseFloat(producto.Precio);
        let precioLiquidacion = Math.ceil(parseFloat(producto.Costo) / 0.80);
        let precioAjustado = precioBase;
        const precioajustadoMinorista = Math.round((precioBase * 0.15) + precioBase);
        const precioajustadoDocena = Math.round((precioBase * 0.25) + precioBase);
        const precioBonificado = Math.ceil(parseFloat(producto.Costo) / 0.80);
        let cambioRealizado = false;

        pdf.setTextColor(255, 193, 7); // Color amarillo para el título
        // Truncar el nombre y el SKU de acuerdo al ancho de la imagen
        const nombreTruncado = truncarTextoPorAncho(pdf, producto.Nombre, anchoImagen);
        pdf.setTextColor(44, 44, 44);
        // Truncar el SKU para que no se salga del ancho de la imagen
        const skuEncoded = producto.SKU.replace('#', '%23');
        const urlImagenJpg = `Fotos/${skuEncoded}.jpg`;

        // Cargar la imagen antes de agregarla al PDF
        const imagenCargada = await cargarImagen(urlImagenJpg).catch(() => cargarImagen(urlImagenJpg));

        if (imagenCargada) {
            pdf.addImage(imagenCargada, 'JPEG', x, y, anchoImagen, altoImagen);
        } else {
            console.warn(`No se pudo cargar la imagen para el SKU ${producto.SKU}`);
        }
        pdf.setFont(undefined, 'normal'); // Font normal
        // Descripion
        pdf.text(nombreTruncado, x, y + altoImagen + 5, { align: 'left' });
        // Unidad de medida
        pdf.text(`Unidad de medida: ${producto.UnidadMedida}`, x, y + altoImagen + 10, { align: 'left' });
        // Sku
        pdf.text(`SKU: ${producto.SKU}`, x, y + altoImagen + 15, { align: 'left' });

        // Precio
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold'); // Negrita para el precio
        // Definir posiciones para los precios
        const espacioColumnas = 15; // Ajusta este valor según el espacio entre las columnas
        pdf.setFontSize(8);

        const titulocentrado = x + anchoImagen / 2;
        // Títulos de los precios
        // pdf.text(`Precio Bonificado`, (x + anchoImagen / 2), y + altoImagen + 20, { align: 'center' });
        // pdf.text(`Blister`, x, y + altoImagen + 20, { align: 'left' });
        // pdf.text(`Distrib.`, x + 16, y + altoImagen + 20, { align: 'left' });
        // pdf.text(`Mayorista`, x + 30, y + altoImagen + 20, { align: 'left' });
        // pdf.text(`Minorista`,titulocentrado, y + altoImagen + 20, { align: 'center' });

        // Precios en una sola línea con espaciado
        pdf.setTextColor(26, 35, 126); // Color azul para los precios
        // pdf.text(
        //     `C$ ${precioAjustado}`,
        //     x, y + altoImagen + 25, { align: 'justify' }
        // );
        pdf.setFontSize(18);
        // const centroPrecio = x + anchoImagen / 2;
        // pdf.text(
        //     `C$ ${precioBonificado}`,
        //     centroPrecio, y + altoImagen + 25, { align: 'center' }
        // );
        // pdf.text(
        //     `C$ ${precioAjustado}           C$ ${precioajustadoMinorista}         C$ ${precioajustadoDocena} `,
        //     x, y + altoImagen + 25, { align: 'left' }
        // );
        const centroPrecio = x + anchoImagen / 2;
        pdf.text(`C$ ${precioajustadoDocena}`, centroPrecio, y + altoImagen + 25, { align: 'center' }
        );
        pdf.setFont(undefined, 'normal'); // Font normal
        pdf.setTextColor(0, 0, 0); // Color normal
        pdf.setFontSize(10);

        x += espacioHorizontal - 4;
        itemActual++;

        if (itemActual % itemsPorFila === 0) {
            x = 5;
            y += espacioVertical;
        }

        if (y > 260) {
            pdf.addPage();
            y = 5;
            x = 5;
        }
    }

    // Generar el Blob del PDF
    const pdfBlob = pdf.output('blob');

    // Crear un objeto URL para previsualizar el PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Abrir en una nueva pestaña para previsualización
    const nuevaVentana = window.open(pdfUrl, '_blank');
    if (!nuevaVentana) {
        alert('Por favor, permite que se abran ventanas emergentes en tu navegador para previsualizar el archivo.');
    }

    // Sugerir nombre para la descarga al usar el ícono del visor
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = nombreArchivo; // Sugerir nombre al descargar
    a.click();
}

function limpiarTextoParaArchivo(texto) {
    return texto.replace(/[\/\\?%*:|"<>]/g, '').trim(); // Elimina caracteres inválidos
}

function agregarPortada(pdf, categoriaSeleccionada, subcategoriaSeleccionada) {
    const anchoPagina = pdf.internal.pageSize.getWidth();
    const altoPagina = pdf.internal.pageSize.getHeight();

    // Colores de fondo según el tipo de cliente
    // const colorFondo = tipoCliente === 'mayorista' ? [255, 193, 7] : tipoCliente === 'minorista' ? [0, 210, 123] : [138, 43, 226]; // Azul claro para mayorista, verde claro para minorista

    // Dibujar fondo
    pdf.setFillColor(255, 193, 7); // Amarillo para el fondo
    // pdf.setFillColor(255, 0, 0); // Rojo para el fondo
    pdf.rect(0, 0, anchoPagina, altoPagina, 'F'); // Rectángulo que cubre toda la página

    // Título principal
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(88);
    // const colorTitulo = tipoCliente === 'mayorista' ? [248, 248, 255] : tipoCliente === 'minorista' ? [0, 0, 0] : [248, 248, 255]; // Azul para mayorista, verde para minorista
    pdf.setTextColor(248, 248, 255); // Negro para el texto principal
    pdf.text('AjSiles', anchoPagina / 2, altoPagina / 2 - 50, { align: 'center' });

    // Subtítulo con diferenciación
    pdf.setFontSize(20);
    // const tipoTexto = tipoCliente === 'mayorista' ? 'Catálogo Mayorista' : tipoCliente === 'minorista' ? 'Catálogo Minorista' : 'Catálogo x Docena';
    // const colorTexto = tipoCliente === 'mayorista' ? [248, 248, 255] : tipoCliente === 'minorista' ? [0, 0, 0] : [248, 248, 255]; // Azul para mayorista, verde para minorista
    pdf.setTextColor(248, 248, 255);
    // pdf.text(tipoTexto, anchoPagina / 2, altoPagina / 2 - 30, { align: 'center' });

    // Categoría y subcategoría
    if (categoriaSeleccionada && categoriaSeleccionada !== "") {
        pdf.setFontSize(20);
        pdf.text(categoriaSeleccionada, anchoPagina / 2, altoPagina / 2 - 20, { align: 'center' });
    }

    if (subcategoriaSeleccionada && subcategoriaSeleccionada !== "") {
        pdf.setFontSize(14);
        pdf.text(subcategoriaSeleccionada, anchoPagina / 2, altoPagina / 2 - 10, { align: 'center' });
    }

    // Fecha actual
    const fechaActual = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    pdf.text(fechaActual, anchoPagina / 2, altoPagina / 2, { align: 'center' });
    pdf.setTextColor(0, 0, 0); // Restablecer color a negro

}

function truncarTextoPorAncho(pdf, texto, anchoMaximo) {
    let textoTruncado = texto;

    // Mientras el ancho del texto sea mayor que el ancho máximo, recorta el texto
    while (pdf.getTextWidth(textoTruncado) > anchoMaximo) {
        textoTruncado = textoTruncado.slice(0, -1); // Elimina el último carácter
    }

    // Añade puntos suspensivos si se truncó
    if (textoTruncado !== texto) {
        textoTruncado += '...';
    }

    return textoTruncado;
}

function cargarImagen(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Habilita la carga desde diferentes dominios si es necesario
        img.onload = () => resolve(img); // Resuelve la promesa con la imagen cargada
        img.onerror = () => reject(`No se pudo cargar la imagen: ${url}`); // Rechazar pero no mostrar error en consola
        img.src = url; // Asigna la URL de la imagen
    });
}