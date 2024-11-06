document.addEventListener('DOMContentLoaded', function() {
    fetch('productos.csv')
        .then(response => response.text())
        .then(data => {
            const productos = Papa.parse(data, { header: true }).data;
            mostrarProductos(productos);
        });
});

function mostrarProductos(productos) {
    const catalogo = document.getElementById('catalogo');
    productos.forEach(producto => {
        const div = document.createElement('div');
        div.classList.add('producto');
        
        div.innerHTML = `
            <img src="${producto.Imagen}" alt="${producto.Nombre}">
            <h2>${producto.Nombre}</h2>
            <p class="sku">SKU: ${producto.SKU}</p>
            <p class="precio">C$ ${producto.Precio}</p>
            <p class="">${producto}</p>
        `;
        
        catalogo.appendChild(div);
    });
}
