(function () {
    // 1. Inyectar CSS de layout
    const cssLink = `<link rel="stylesheet" href="/css/layout.css">`;
    document.head.insertAdjacentHTML('beforeend', cssLink);

    // 2. Header
    const header = `
    <nav class="navbar bg-dark">
      <div class="container">
        <a class="navbar-brand" href="/"><span class="text-light">AjSiles</span></a>
        <ul class="nav">
          <li class="nav-item"><a class="nav-link text-light" href="/catalogo">Catálogo</a></li>
          <li class="nav-item"><a class="nav-link text-light" href="/comisiones">Comisiones</a></li>
          <li class="nav-item"><a class="nav-link text-light" href="/facturas">Facturas</a></li>
          <li class="nav-item"><a class="nav-link text-light" href="/products-expire">Productos por expirar</a></li>
        </ul>
      </div>
    </nav>
  `;

    // 3. Footer
    const footer = `
    <footer class="bg-dark text-white py-3 mt-5">
      <div class="container text-center">
        <p class="mb-0">&copy; ${new Date().getFullYear()} AjSiles Mayorista</p>
      </div>
    </footer>
  `;

    // 4. Insertar en DOM
    document.addEventListener("DOMContentLoaded", () => {
        document.body.insertAdjacentHTML("afterbegin", header);
        document.body.insertAdjacentHTML("beforeend", footer);

        // 5. Activar link del menú según página actual
        const path = location.pathname.replace(/\/+$/, ''); // sin trailing slash
        document.body.classList.add('page-page-layout');
        // marcar link activo
        document.querySelectorAll('.nav-link').forEach(a => {
            if (a.getAttribute('href') === path) a.classList.add('active');
        });

    });
})();