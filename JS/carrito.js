/* ============================================================
   carrito.js  ·  Carrito de compras dinámico
   ------------------------------------------------------------
   - Persiste en IndexedDB (store "carrito") -> sobrevive a
     recargas y cierres del navegador.
   - Contador en tiempo real en la NavBar.
   - Vista en offcanvas de Bootstrap con edición de cantidades,
     eliminación de productos y total dinámico.
   ============================================================ */

const Carrito = {
  /** Suma un producto al carrito (o incrementa su cantidad). */
  async agregar(producto) {
    const existente = await DB.obtenerItem(producto.id);
    if (existente) {
      existente.cantidad += 1;
      await DB.guardarItem(existente);
    } else {
      await DB.guardarItem({
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
    const item = await DB.obtenerItem(id);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) {
      await DB.eliminarItem(id);
    } else {
      await DB.guardarItem(item);
    }
    await this.refrescar();
  },

  async eliminar(id) {
    await DB.eliminarItem(id);
    await this.refrescar();
  },

  async vaciar() {
    await DB.vaciarCarrito();
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

  /** Lee el carrito y vuelve a dibujar contador + lista. */
  async refrescar() {
    const items = await DB.obtenerCarrito();
    this.pintarContador(items);
    this.pintarLista(items);
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
