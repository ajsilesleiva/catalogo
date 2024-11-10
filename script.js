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
    let y = 20;

    pdf.setFontSize(18);
    pdf.text("Catálogo de Productos", 10, y);
    y += 10;

    pdf.setFontSize(12);

    const productos = document.querySelectorAll('.producto');
    let x = 10;
    const anchoImagen = 40;
    const altoImagen = 50;
    const espacioHorizontal = 70;
    const espacioVertical = 60;
    let itemsPorFila = 3;
    let itemActual = 0;

    for (let i = 0; i < productos.length; i++) {
        const producto = productos[i];
        const imgElement = producto.querySelector('.producto-img');
        const nombre = producto.querySelector('h2').textContent;
        const sku = producto.querySelector('.sku').textContent;
        const precio = producto.querySelector('.precio').textContent;

        try {
            const imgData = await convertirImagenADatosBase64(imgElement);
            pdf.addImage(imgData, 'JPEG', x, y, anchoImagen, altoImagen);
        } catch (error) {
            console.error("Error al procesar la imagen", error);
        }

        pdf.text(nombre, x, y + altoImagen + 5);
        pdf.text(sku, x, y + altoImagen + 15);
        pdf.setTextColor(255, 0, 0);
        pdf.text(precio, x, y + altoImagen + 25);
        pdf.setTextColor(0, 0, 0);

        x += espacioHorizontal;
        itemActual++;

        if (itemActual % itemsPorFila === 0) {
            x = 10;
            y += espacioVertical;
        }

        if (y > 260) {
            pdf.addPage();
            y = 20;
            x = 10;
        }

        // Pausar la ejecución después de cada producto para reducir la carga
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    pdf.save("catalogo_productos.pdf");
}

// Función auxiliar para convertir una imagen del DOM a base64
async function convertirImagenADatosBase64(imgElement) {
    const canvas = document.createElement("canvas");
    canvas.width = imgElement.width * 0.5; // Reducir resolución al 50%
    canvas.height = imgElement.height * 0.5;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg");
}
