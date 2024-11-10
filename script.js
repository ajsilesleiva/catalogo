document.addEventListener('DOMContentLoaded', function() {
    fetch('productos.csv')
        .then(response => response.text())
        .then(data => {
            const productos = Papa.parse(data, { header: true }).data;
            // Filtrar productos vacíos
            const productosValidos = productos.filter(producto => producto.SKU && producto.Nombre && producto.Precio);
            mostrarProductos(productosValidos);
        });
});

function mostrarProductos(productos) {
    const catalogo = document.getElementById('catalogo');
    productos.forEach(producto => {
        const div = document.createElement('div');
        div.classList.add('producto');

        // Reemplaza el `#` por `%23` en el SKU para la URL de la imagen
        const skuEncoded = producto.SKU.replace('#', '%23');
        const urlImagenJpg = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${skuEncoded}.jpg`;
        const urlImagenPng = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${skuEncoded}.png`;

        const imagen = new Image();

        // Función para cargar la imagen en el DOM si está disponible
        const mostrarImagen = (url) => {
            div.innerHTML = `
                <img src="${url}" alt="${producto.Nombre}" loading="lazy">
                <h2>${producto.Nombre}</h2>
                <p class="sku">SKU: ${producto.SKU}</p>
                <p class="precio">C$ ${producto.Precio}</p>
            `;
            catalogo.appendChild(div);
        };

        // Primero intenta cargar la imagen en formato .jpg, luego .png
        imagen.onload = function() {
            mostrarImagen(imagen.src); // Si carga correctamente, muestra la imagen
        };

        imagen.onerror = function() {
            // Si falla cargar la imagen .jpg, intenta cargar la imagen .png
            imagen.src = urlImagenPng;
            imagen.onerror = function() {
                // Si también falla cargar la imagen .png, muestra la imagen de respaldo
                mostrarImagen('https://via.placeholder.com/150');
            };
        };

        // Establece la fuente inicial de la imagen para intentar cargar .jpg
        imagen.src = urlImagenJpg;

        // Lazy loading con Intersection Observer
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Carga la imagen al entrar en la vista
                        entry.target.src = imagen.src;
                        observer.unobserve(entry.target); // Deja de observar después de cargar
                    }
                });
            });

            const lazyImage = document.createElement('img');
            lazyImage.setAttribute('data-src', imagen.src);
            lazyImage.setAttribute('alt', producto.Nombre);
            lazyImage.setAttribute('loading', 'lazy');
            div.appendChild(lazyImage);

            observer.observe(lazyImage);
        }
    });
}

// Función para generar el PDF del catálogo
function generarPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    // Configurar el título del PDF
    pdf.setFontSize(16);
    pdf.text("Catálogo de Productos", 10, 10);

    // Configuración de posición y estilo de fuente
    let y = 20;
    pdf.setFontSize(12);

    // Recorrer los productos para añadirlos al PDF
    fetch('productos.csv')
        .then(response => response.text())
        .then(data => {
            const productos = Papa.parse(data, { header: true }).data;

            // Filtrar productos válidos y evitar productos vacíos
            const productosValidos = productos.filter(producto => producto.SKU && producto.Nombre && producto.Precio);

            productosValidos.forEach((producto, index) => {
                // Añadir los detalles de cada producto
                pdf.text(`Producto: ${producto.Nombre}`, 10, y);
                pdf.text(`SKU: ${producto.SKU}`, 10, y + 10);
                pdf.text(`Precio: C$ ${producto.Precio}`, 10, y + 20);

                // Espaciado entre productos
                y += 30;
                
                // Crear una nueva página si es necesario
                if (y > 270) {
                    pdf.addPage();
                    y = 10; // Restablecer posición y para la nueva página
                }
            });

            // Descargar el PDF
            pdf.save("catalogo_productos.pdf");
        });
}
