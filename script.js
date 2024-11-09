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

        // Verifica si la imagen .jpg o .png está disponible y luego la muestra
        verificarImagen(producto.SKU, (urlImagen) => {
            div.innerHTML = `
                <img src="${urlImagen}" alt="${producto.Nombre}">
                <h2>${producto.Nombre}</h2>
                <p class="sku">SKU: ${producto.SKU}</p>
                <p class="precio">C$ ${producto.Precio}</p>
            `;
            catalogo.appendChild(div);
        });
    });
}

// Función para verificar si una imagen .jpg o .png existe en el servidor
function verificarImagen(sku, callback) {
    const urlJpg = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${sku}.jpg`;
    const urlPng = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${sku}.png`;

    fetch(urlJpg).then(response => {
        if (response.ok) {
            callback(urlJpg);
        } else {
            // Si la imagen .jpg no está disponible, intenta cargar .png
            fetch(urlPng).then(response => {
                if (response.ok) {
                    callback(urlPng);
                } else {
                    // Si no encuentra ninguna de las dos, usa una imagen de respaldo
                    callback('https://via.placeholder.com/150'); // Imagen de respaldo
                }
            });
        }
    });
}
