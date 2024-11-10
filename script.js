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
    productos.forEach(producto => {
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

async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    // Capturar el contenedor de productos con html2canvas
    const catalogo = document.getElementById('catalogo');
    
    await html2canvas(catalogo, {
        allowTaint: true,  // Permitir tainting
        useCORS: true,     // Usar CORS para permitir acceso a imágenes externas
        scale: 2           // Aumenta el scale para mejorar la calidad
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);

        // Agregar la imagen al PDF
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        // Descargar el PDF
        pdf.save("catalogo_productos.pdf");
    }).catch(error => {
        console.error("Error al capturar el catálogo:", error);
    });
}
// async function generarPDF() {
//     const { jsPDF } = window.jspdf;
//     const pdf = new jsPDF();
//     let y = 20;

//     // Título del PDF
//     pdf.setFontSize(18);
//     pdf.text("Catálogo de Productos", 10, y);
//     y += 15;

//     pdf.setFontSize(12);

//     const productos = document.querySelectorAll('.producto');
//     let x = 10;
//     const anchoImagen = 40;
//     const altoImagen = 50;
//     const espacioHorizontal = 70;
//     const espacioVertical = 80;
//     let itemsPorFila = 3;
//     let itemActual = 0;

//     for (let i = 0; i < productos.length; i++) {
//         const producto = productos[i];
//         const imgElement = producto.querySelector('.producto-img');
//         console.log(imgElement)
//         const nombre = producto.querySelector('h2').textContent;
//         const sku = producto.querySelector('.sku').textContent;
//         const precio = producto.querySelector('.precio').textContent;

//         try {
//             // Convertir imagen del DOM a base64, usar placeholder si falla
//             const imgData = await convertirImagenADatosBase64(imgElement);
//             pdf.addImage(imgData, 'JPEG', x, y, anchoImagen, altoImagen);
//         } catch (error) {
//             console.error("Error al procesar la imagen", error);
//             pdf.text("Imagen no disponible", x, y + altoImagen / 2);
//         }

//         // Añadir el texto del producto
//         pdf.text(nombre, x, y + altoImagen + 5, { maxWidth: 50 });
//         pdf.text(sku, x, y + altoImagen + 15, { maxWidth: 50 });
//         pdf.setTextColor(255, 0, 0);
//         pdf.text(precio, x, y + altoImagen + 25, { maxWidth: 50 });
//         pdf.setTextColor(0, 0, 0);

//         x += espacioHorizontal + anchoImagen;
//         itemActual++;

//         if (itemActual % itemsPorFila === 0) {
//             x = 10;
//             y += espacioVertical;
//         }

//         if (y > 260) {
//             pdf.addPage();
//             y = 20;
//             x = 10;
//         }
//     }

//     pdf.save("catalogo_productos.pdf");
// }

// // Función auxiliar para convertir la imagen del DOM a base64
// async function convertirImagenADatosBase64(imgElement) {
//     const canvas = document.createElement("canvas");
//     canvas.width = imgElement.width * 0.5; // Reducir resolución
//     canvas.height = imgElement.height * 0.5;
//     const ctx = canvas.getContext("2d");

//     // Dibujar imagen y capturar como base64
//     try {
//         ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
//         return canvas.toDataURL("image/jpeg");
//     } catch (error) {
//         console.error("Error en la conversión de la imagen a base64:", error);
//         // return "https://via.placeholder.com/150"; // Placeholder si falla la conversión
//     }
// }
