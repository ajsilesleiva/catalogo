document.addEventListener('DOMContentLoaded', () => {
    const inputSearch = document.getElementById('searchInvoice');
    const listSuggestions = document.getElementById('autocompleteList');
    const infoFactura = document.getElementById('infoFactura');

    let facturas = []; // Aquí guardaremos todas las facturas { invoice_number, total_weight, date, status }

    // 1) Cargar TODAS las facturas al iniciar
    fetch('/api/invoices')
        .then(resp => {
            if (!resp.ok) throw new Error(`Error al obtener facturas: ${resp.status}`);
            return resp.json();
        })
        .then(data => {
            facturas = data || [];
            console.log('Facturas cargadas =>', facturas);
        })
        .catch(err => {
            console.error(err);
            infoFactura.innerHTML = `<p style="color:red;">Error al cargar facturas</p>`;
        });

    // 2) Manejar la escritura en el input para mostrar sugerencias
    inputSearch.addEventListener('input', onSearchInput);

    // Si el usuario hace clic en cualquier parte del documento,
    // podemos ocultar la lista de sugerencias si no se clickeó en ellas
    document.addEventListener('click', (event) => {
        if (!listSuggestions.contains(event.target) && event.target !== inputSearch) {
            listSuggestions.innerHTML = '';
        }
    });

    // -------------------------------------------
    // Función: al escribir en el input, filtrar facturas
    // -------------------------------------------
    function onSearchInput() {
        const searchTerm = inputSearch.value.trim().toLowerCase();
        if (!searchTerm) {
            listSuggestions.innerHTML = '';
            return;
        }

        // Filtrar por invoice_number que contenga searchTerm
        // Ajusta si quieres filtrar por date o status
        const matches = facturas.filter(f =>
            f.invoice_number.toLowerCase().includes(searchTerm)
        );

        // Mostrar las primeras 10 coincidencias (por ejemplo)
        const topResults = matches.slice(0, 10);

        // Renderizar la lista
        listSuggestions.innerHTML = topResults.map(f => `
        <li data-id="${f.invoice_id}">${f.invoice_number}</li>
      `).join('');

        // Añadir evento click a cada <li> para seleccionar esa factura
        const items = listSuggestions.querySelectorAll('li');
        items.forEach(li => {
            li.addEventListener('click', onSelectSuggestion);
        });
    }

    // -------------------------------------------
    // Función: al hacer click en una sugerencia
    // -------------------------------------------
    function onSelectSuggestion(e) {
        const infoFactura = document.getElementById('infoFactura');
        let facturaSel = {};

        const li = e.target;
        // const facturaTexto = li.textContent;
        const invoiceId = li.getAttribute('data-id');  // Obtener número de factura

        // 1) Cargar las factura seleccionada
        fetch(`/api/invoice/` + invoiceId)
            .then(resp => {
                if (!resp.ok) throw new Error(`Error al obtener factura: ${resp.status}`);
                return resp.json();
            })
            .then(responseData => {
                if (!responseData || responseData.length === 0) {
                    infoFactura.innerHTML = `<p style="color:red;">Factura no encontrada</p>`;
                    return;
                }
                // Asumimos que la primera coincidencia es la correcta
                const facturaSel = responseData;

                console.log('Factura encontrada =>', facturaSel);

                // Mostrar detalles
                mostrarDetallesFactura(facturaSel);

                // Actualizar el campo de búsqueda con la factura seleccionada
                inputSearch.value = facturaSel.invoice_number;
                listSuggestions.innerHTML = '';
            })
            .catch(err => {
                console.error(err);
                infoFactura.innerHTML = `<p style="color:red;">Error al cargar facturas</p>`;
            });

        // Ponemos el valor en el input
        inputSearch.value = facturaSel.invoice_number;
        // Ocultar sugerencias
        listSuggestions.innerHTML = '';

        // Mostrar detalles
        mostrarDetallesFactura(facturaSel);
    }

    // -------------------------------------------
    // Función: mostrar detalles de la factura
    // -------------------------------------------
    function mostrarDetallesFactura(factura) {
        // Construir una tabla o algo visual
        infoFactura.innerHTML = `
        <h2>Detalles de Factura</h2>
        <table>
          <tr><th>Número</th><td>${factura.invoice_number}</td></tr>
          <tr><th>Fecha</th><td>${factura.date || ''}</td></tr>
          <tr><th>Estado</th><td>${factura.status || ''}</td></tr>
          <tr><th>Peso Total</th><td>${factura.total_weight || 0}</td></tr>
        </table>
      `;
    }

});