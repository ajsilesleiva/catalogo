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

        // URLs para .jpg y .png
        const urlImagenJpg = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${producto.SKU}.jpg`;
        const urlImagenPng = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${producto.SKU}.png`;

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
