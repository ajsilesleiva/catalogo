let productosValidos = []; // Variable global para almacenar productos con imágenes en base64

document.addEventListener('DOMContentLoaded', function() {
    fetch('productos.csv')
        .then(response => response.text())
        .then(data => {
            const productos = Papa.parse(data, { header: true }).data;
            // Filtrar productos vacíos
            productosValidos = productos.filter(producto => producto.SKU && producto.Nombre && producto.Precio);
            
            // Convertir imágenes a base64 y luego mostrar productos
            convertirImagenesABase64(productosValidos).then(productosConImagenes => {
                productosValidos = productosConImagenes; // Guardamos productos con imágenes en base64
                mostrarProductos(productosValidos); // Mostramos los productos
            });
        });
});

async function convertirImagenesABase64(productos) {
    const productosConImagenes = await Promise.all(productos.map(async (producto) => {
        const skuEncoded = producto.SKU.replace('#', '%23');
        const urlImagenJpg = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${skuEncoded}.jpg`;
        const urlImagenPng = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${skuEncoded}.png`;

        try {
            producto.imagenBase64 = await obtenerImagenComoBase64(urlImagenJpg);
        } catch {
            try {
                producto.imagenBase64 = await obtenerImagenComoBase64(urlImagenPng);
            } catch {
                producto.imagenBase64 = 'https://via.placeholder.com/150'; // Imagen de respaldo
            }
        }
        return producto;
    }));

    return productosConImagenes;
}

function mostrarProductos(productos) {
    const catalogo = document.getElementById('catalogo');
    productos.forEach(producto => {
        const div = document.createElement('div');
        div.classList.add('producto');

        div.innerHTML = `
            <img src="${producto.imagenBase64}" alt="${producto.Nombre}" loading="lazy">
            <h2>${producto.Nombre}</h2>
            <p class="sku">SKU: ${producto.SKU}</p>
            <p class="precio">C$ ${producto.Precio}</p>
        `;
        catalogo.appendChild(div);
    });
}

function generarPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    let y = 20; // Margen superior inicial

    // Configuración del título
    pdf.setFontSize(18);
    pdf.text("Catálogo de Productos", 10, y);
    y += 10;

    pdf.setFontSize(12);

    let x = 10; // Margen izquierdo inicial
    const anchoImagen = 40;
    const altoImagen = 50;
    const espacioHorizontal = 70;
    const espacioVertical = 60;
    let itemsPorFila = 3;
    let itemActual = 0;

    for (const producto of productosValidos) {
        if (!producto.imagenBase64 || producto.imagenBase64 === 'https://via.placeholder.com/150') continue;

        // Añadir imagen en base64
        pdf.addImage(producto.imagenBase64, 'JPEG', x, y, anchoImagen, altoImagen);

        // Añadir texto de producto
        pdf.text(`${producto.Nombre}`, x, y + altoImagen + 5);
        pdf.text(`SKU: ${producto.SKU}`, x, y + altoImagen + 15);
        pdf.setTextColor(255, 0, 0); // Color rojo para el precio
        pdf.text(`C$ ${producto.Precio}`, x, y + altoImagen + 25);
        pdf.setTextColor(0, 0, 0); // Restaurar color a negro

        // Configurar posición para el siguiente producto
        x += espacioHorizontal;
        itemActual++;

        if (itemActual % itemsPorFila === 0) {
            x = 10;
            y += espacioVertical;
        }

        if (y > 260) {
            pdf.addPage();
            y = 20; // Restablecer margen superior
            x = 10; // Restablecer margen izquierdo
        }
    }

    // Descargar el PDF
    pdf.save("catalogo_productos.pdf");
}

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
