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
        
        const urlImagen = `https://ibrizantstorage.s3.sa-east-1.amazonaws.com/Catalogo2024/${producto.SKU}.jpg`;
        const imagen = new Image();
        
        // Si la imagen carga correctamente, agrégala al DOM
        imagen.onload = function() {
            div.innerHTML = `
                <img src="${urlImagen}" alt="${producto.Nombre}" loading="lazy">
                <h2>${producto.Nombre}</h2>
                <p class="sku">SKU: ${producto.SKU}</p>
                <p class="precio">C$ ${producto.Precio}</p>
            `;
            catalogo.appendChild(div);
        };

        // Si falla después de un tiempo, muestra la imagen de respaldo
        setTimeout(() => {
            if (!imagen.complete || imagen.naturalWidth === 0) {
                div.innerHTML = `
                    <img src="https://via.placeholder.com/150" alt="${producto.Nombre}">
                    <h2>${producto.Nombre}</h2>
                    <p class="sku">SKU: ${producto.SKU}</p>
                    <p class="precio">C$ ${producto.Precio}</p>
                `;
                catalogo.appendChild(div);
            }
        }, 3000); // Espera de 3 segundos antes de mostrar imagen de respaldo

        // Establece la fuente de la imagen para iniciar la carga
        imagen.src = urlImagen;

        // Lazy loading con Intersection Observer
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Una vez que el elemento es visible, inicia la carga de la imagen
                        entry.target.src = urlImagen;
                        observer.unobserve(entry.target); // Deja de observar después de cargar
                    }
                });
            });

            const lazyImage = document.createElement('img');
            lazyImage.setAttribute('data-src', urlImagen);
            lazyImage.setAttribute('alt', producto.Nombre);
            lazyImage.setAttribute('loading', 'lazy');
            div.appendChild(lazyImage);

            observer.observe(lazyImage);
        }
    });
}
