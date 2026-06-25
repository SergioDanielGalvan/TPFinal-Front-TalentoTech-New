/* ============================================================
   carrito.js  ·  Carrito de compras dinámico (por usuario)
   ------------------------------------------------------------
   - Persiste en IndexedDB (store "carrito") asociado al
     usuario logueado -> cada cuenta tiene su propio carrito.
   - Sin sesión activa, el carrito se muestra vacío (el badge
     no arrastra ítems de un usuario que ya cerró sesión).
   - Contador en tiempo real en la NavBar.
   - Vista en offcanvas de Bootstrap con edición de cantidades,
     eliminación de productos y total dinámico.
   ============================================================ */

const Carrito = {
  /**
   * Devuelve el identificador del usuario logueado (su correo)
   * o null si no hay sesión.
   *
   * ⚠️ IMPORTANTE: esta lectura debe coincidir con cómo guardás
   * la sesión en auth.js. Acá se asume sessionStorage bajo la
   * clave "sesion" con un objeto que tiene { correo }. Si usás
   * otra clave u otro campo, ajustá solo estas líneas.
   */
  usuarioActual() {
    const raw = sessionStorage.getItem("sesion");
    if (!raw) return null;
    try {
      return JSON.parse(raw).correo || null;
    } catch {
      return raw; // por si guardás el correo como string plano
    }
  },

  /** Suma un producto al carrito (o incrementa su cantidad). */
  async agregar(producto) {
    const usuarioId = this.usuarioActual();
    if (!usuarioId) return; // sin sesión no hay carrito

    const existente = await DB.obtenerItem(usuarioId, producto.id);
    if (existente) {
      existente.cantidad += 1;
      await DB.guardarItem(existente);
    } else {
      await DB.guardarItem({
        usuarioId,
        id: producto.id,
        titulo: producto.titulo,
        precio: producto.precio,
        imagen: producto.imagen,
        categoria: producto.categoria,
        cantidad: 1,
      });
    }
    await this.refrescar();
  },

  /** Cambia la cantidad de un item. Si llega a 0, lo elimina. */
  async cambiarCantidad(id, delta) {
    const usuarioId = this.usuarioActual();
    if (!usuarioId) return;

    const item = await DB.obtenerItem(usuarioId, id);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) {
      await DB.eliminarItem(usuarioId, id);
    } else {
      await DB.guardarItem(item);
    }
    await this.refrescar();
  },

  async eliminar(id) {
    const usuarioId = this.usuarioActual();
    if (!usuarioId) return;
    await DB.eliminarItem(usuarioId, id);
    await this.refrescar();
  },

  async vaciar() {
    const usuarioId = this.usuarioActual();
    if (!usuarioId) return;
    await DB.vaciarCarrito(usuarioId);
    await this.refrescar();
  },

  /** Total en dinero del carrito. */
  total(items) {
    return items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  },

  /** Cantidad total de unidades (para el contador). */
  cantidadTotal(items) {
    return items.reduce((acc, i) => acc + i.cantidad, 0);
  },

  /** Lee el carrito del usuario activo y vuelve a dibujar contador + lista. */
  async refrescar() {
    const usuarioId = this.usuarioActual();
    const items = usuarioId ? await DB.obtenerCarrito(usuarioId) : [];
    this.pintarContador(items);
    this.pintarLista(items);
  },

  /**
   * Llamar desde el logout (auth.js): limpia el badge y la vista
   * SIN borrar datos. El carrito queda guardado para cuando el
   * usuario vuelva a iniciar sesión.
   */
  alCerrarSesion() {
    this.pintarContador([]);
    this.pintarLista([]);
  },

  pintarContador(items) {
    const cont = document.getElementById("contador-carrito");
    if (!cont) return;
    const n = this.cantidadTotal(items);
    cont.textContent = n;
    cont.classList.toggle("d-none", n === 0);
  },

  pintarLista(items) {
    const lista = document.getElementById("lista-carrito");
    const totalEl = document.getElementById("total-carrito");
    const vacioEl = document.getElementById("carrito-vacio");
    if (!lista) return;

    lista.innerHTML = "";

    if (items.length === 0) {
      if (vacioEl) vacioEl.classList.remove("d-none");
      if (totalEl) totalEl.textContent = formatearPrecio(0);
      return;
    }
    if (vacioEl) vacioEl.classList.add("d-none");

    items.forEach((item) => {
      const fila = document.createElement("div");
      fila.className =
        "carrito-item d-flex align-items-center gap-3 py-3 border-bottom";
      fila.innerHTML = `
        <img src="${item.imagen}" alt="${item.titulo}"
             class="carrito-item__img" width="64" height="64">
        <div class="flex-grow-1">
          <p class="carrito-item__titulo mb-1">${item.titulo}</p>
          <small class="text-secondary">${formatearPrecio(item.precio)} c/u</small>
          <div class="d-flex align-items-center gap-2 mt-2">
            <button class="btn btn-sm btn-outline-light btn-menos"
                    data-id="${item.id}" aria-label="Quitar uno">−</button>
            <span class="px-2">${item.cantidad}</span>
            <button class="btn btn-sm btn-outline-light btn-mas"
                    data-id="${item.id}" aria-label="Agregar uno">+</button>
            <button class="btn btn-sm btn-link text-danger ms-auto btn-quitar"
                    data-id="${item.id}">Eliminar</button>
          </div>
        </div>
        <strong class="carrito-item__subtotal">
          ${formatearPrecio(item.precio * item.cantidad)}
        </strong>`;
      lista.appendChild(fila);
    });

    if (totalEl) totalEl.textContent = formatearPrecio(this.total(items));

    // Eventos de cada control.
    lista.querySelectorAll(".btn-menos").forEach((b) =>
      b.addEventListener("click", () => this.cambiarCantidad(b.dataset.id, -1))
    );
    lista.querySelectorAll(".btn-mas").forEach((b) =>
      b.addEventListener("click", () => this.cambiarCantidad(b.dataset.id, +1))
    );
    lista.querySelectorAll(".btn-quitar").forEach((b) =>
      b.addEventListener("click", () => this.eliminar(b.dataset.id))
    );
  },
};

/** Formatea un número como precio en dólares. */
function formatearPrecio(valor) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(valor);
}

window.Carrito = Carrito;
window.formatearPrecio = formatearPrecio;
