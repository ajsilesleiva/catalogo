const imagenesCargadas = []; // Array para almacenar las URLs de imágenes cargadas

document.addEventListener('DOMContentLoaded', function() {
    fetch('productos.csv')
        .then(response => response.text())
        .then(data => {
            const productos = Papa.parse(data, { header: true }).data;
            const productosValidos = productos.filter(producto => producto.SKU && producto.Nombre && producto.Precio);
            mostrarProductos(productosValidos);
        });
});

function mostrarProductos(productos) {
    const catalogo = document.getElementById('catalogo');
    productos.forEach((producto, index) => {
        const div = document.createElement('div');
        div.classList.add('producto');

        const skuEncoded = producto.SKU.replace('#', '%23');
        const urlImagenJpg = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${skuEncoded}.jpg`;
        const urlImagenPng = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${skuEncoded}.png`;

        const imagen = new Image();

        const mostrarImagen = (url) => {
            div.innerHTML = `
                <img src="${url}" alt="${producto.Nombre}" loading="lazy" class="producto-img">
                <h2>${producto.Nombre}</h2>
                <p class="sku">SKU: ${producto.SKU}</p>
                <p class="precio">C$ ${producto.Precio}</p>
            `;
            catalogo.appendChild(div);

            // Guardar la URL de la imagen en el array
            imagenesCargadas[index] = url;
        };

        imagen.onload = function() {
            mostrarImagen(imagen.src);
        };

        imagen.onerror = function() {
            imagen.src = urlImagenPng;
            imagen.onerror = function() {
                mostrarImagen('https://via.placeholder.com/150');
            };
        };

        imagen.src = urlImagenJpg;
    });
}

function generarPDF() {
    const catalogo = document.getElementById('catalogo'); // Contenedor del catálogo de productos

    // Configuración de opciones de html2pdf
    const options = {
        margin: 1, // Margen en pulgadas
        filename: 'catalogo_productos.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Reemplazar imágenes en el DOM con las URLs en imagenesCargadas antes de generar el PDF
    const productosDivs = catalogo.getElementsByClassName('producto');
    Array.from(productosDivs).forEach((div, index) => {
        const img = div.querySelector('img');
        if (img) {
            img.src = imagenesCargadas[index] || 'https://via.placeholder.com/150';
        }
    });

    // Generar el PDF
    html2pdf().set(options).from(catalogo).save();
}
