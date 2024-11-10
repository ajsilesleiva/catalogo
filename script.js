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
async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    let y = 20; // Margen superior inicial

    // Configuración del título
    pdf.setFontSize(18);
    pdf.text("Catálogo de Productos", 10, y);
    y += 10;

    pdf.setFontSize(12);

    // Recorrer los productos para añadirlos al PDF
    const response = await fetch('productos.csv');
    const data = await response.text();
    const productos = Papa.parse(data, { header: true }).data;
    const productosValidos = productos.filter(producto => producto.SKU && producto.Nombre && producto.Precio);

    // Configuración de la cuadrícula
    let x = 10; // Margen izquierdo inicial
    const anchoImagen = 40;
    const altoImagen = 50;
    const espacioHorizontal = 70;
    const espacioVertical = 60;
    let itemsPorFila = 3;
    let itemActual = 0;

    for (const producto of productosValidos) {
        // Añadir imagen desde la URL
        const skuEncoded = producto.SKU.replace('#', '%23');
        const urlImagenJpg = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${skuEncoded}.jpg`;

        try {
            const imgData = await obtenerImagenComoBase64(urlImagenJpg);
            pdf.addImage(imgData, 'JPEG', x, y, anchoImagen, altoImagen);
        } catch (error) {
            console.error("Error al cargar imagen", error);
        }

        // Añadir texto de producto
        pdf.text(`${producto.Nombre}`, x, y + altoImagen + 5);
        pdf.text(`SKU: ${producto.SKU}`, x, y + altoImagen + 15);
        pdf.setTextColor(255, 0, 0); // Color rojo para el precio
        pdf.text(`C$ ${producto.Precio}`, x, y + altoImagen + 25);
        pdf.setTextColor(0, 0, 0); // Restaurar color a negro

        // Configurar posición para el siguiente producto
        x += espacioHorizontal;
        itemActual++;

        // Saltar a la siguiente fila si alcanzamos el límite de items por fila
        if (itemActual % itemsPorFila === 0) {
            x = 10;
            y += espacioVertical;
        }

        // Añadir una nueva página si se alcanza el final de la página actual
        if (y > 260) {
            pdf.addPage();
            y = 20; // Restablecer margen superior
            x = 10; // Restablecer margen izquierdo
        }
    }

    // Descargar el PDF
    pdf.save("catalogo_productos.pdf");
}

// Función auxiliar para obtener la imagen como base64 usando html2canvas
async function obtenerImagenComoBase64(url) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    return new Promise((resolve, reject) => {
        img.onload = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg"));
        };
        img.onerror = error => reject(error);
    });
}
