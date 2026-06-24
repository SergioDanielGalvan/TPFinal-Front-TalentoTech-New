/* ============================================================
   app.js  ·  Orquestador de la aplicación
   ------------------------------------------------------------
   - Consume la "API REST" (datos/productos.json) con fetch.
   - Renderiza las cards de productos en el DOM.
   - Valida los formularios de login, registro y contacto.
   - Inicializa cada página según los elementos presentes.
   ============================================================ */

const RUTA_API = "datos/productos.json";

/* ---------------- Productos (fetch + render) ---------------- */

async function cargarProductos() {
  const grilla = document.getElementById("grilla-productos");
  const grillaDest = document.getElementById("grilla-destacados");
  if (!grilla && !grillaDest) return;

  try {
    let productos;
    try {
      const respuesta = await fetch(RUTA_API);
      if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
      productos = await respuesta.json();
    } catch (errFetch) {
      // fetch falla al abrir con file:// -> usamos la copia embebida.
      if (window.PRODUCTOS_FALLBACK) {
        productos = window.PRODUCTOS_FALLBACK;
        console.warn("fetch no disponible; usando datos embebidos.", errFetch);
      } else {
        throw errFetch;
      }
    }

    // Fila de destacados (3 columnas más anchas).
    if (grillaDest) {
      const destacados = productos.filter((p) => p.destacado);
      renderProductos(destacados, grillaDest, "col-12 col-sm-6 col-lg-4");
    }
    // Catálogo completo (4 por fila en pantallas grandes).
    if (grilla) {
      renderProductos(productos, grilla, "col-12 col-sm-6 col-lg-4 col-xl-3");
    }
  } catch (error) {
    const msg = `
      <div class="col-12 text-center text-secondary py-5">
        <p>No se pudieron cargar los productos.</p>
        <small>Verificá tu conexión o recargá la página.</small>
      </div>`;
    if (grillaDest) grillaDest.innerHTML = msg;
    if (grilla) grilla.innerHTML = msg;
    console.error("Error al cargar productos:", error);
  }
}

function renderProductos(productos, grilla, colClass) {
  grilla.innerHTML = "";
  const logueado = !!(window.Auth && Auth.usuarioActivo());

  productos.forEach((p) => {
    const col = document.createElement("div");
    col.className = colClass;
    col.innerHTML = `
      <article class="card-producto h-100">
        <div class="card-producto__media">
          <span class="card-producto__cat">${p.categoria}</span>
          <img src="${p.imagen}" alt="${p.titulo}" loading="lazy">
        </div>
        <div class="card-producto__cuerpo">
          <h3 class="card-producto__titulo">${p.titulo}</h3>
          <ul class="card-producto__specs">
            ${p.specs.slice(0, 3).map((s) => `<li>${s}</li>`).join("")}
          </ul>
          ${p.url ? `<a class="card-producto__fabricante" href="${encodeURI(p.url)}"
               target="_blank" rel="noopener noreferrer">Ver en fabricante ↗</a>` : ""}
          <div class="card-producto__pie">
            <span class="card-producto__precio">${formatearPrecio(p.precio)}</span>
            <button class="btn btn-acento btn-sm btn-agregar" data-id="${p.id}"
                    ${logueado ? "" : `disabled title="Iniciá sesión para agregar productos"`}>
              Agregar al carrito
            </button>
          </div>
        </div>
      </article>`;
    grilla.appendChild(col);

    col.querySelector(".btn-agregar").addEventListener("click", () => {
      if (!Auth.usuarioActivo()) {
        mostrarToast("Iniciá sesión para agregar productos.");
        return;
      }
      Carrito.agregar(p);
      mostrarToast(`"${p.titulo}" agregado al carrito`);
    });
  });
}

/* Habilita/deshabilita los botones "Agregar" según haya sesión.
   Se llama tras renderizar y cada vez que cambia la sesión. */
function actualizarBotonesAgregar() {
  const logueado = !!(window.Auth && Auth.usuarioActivo());
  document.querySelectorAll(".btn-agregar").forEach((b) => {
    b.disabled = !logueado;
    b.title = logueado ? "" : "Iniciá sesión para agregar productos";
  });
}
window.actualizarBotonesAgregar = actualizarBotonesAgregar;

/* ---------------- Toast de avisos ---------------- */

function mostrarToast(mensaje) {
  let zona = document.getElementById("zona-toast");
  if (!zona) {
    zona = document.createElement("div");
    zona.id = "zona-toast";
    zona.className = "toast-zona";
    document.body.appendChild(zona);
  }
  const t = document.createElement("div");
  t.className = "toast-aviso";
  t.textContent = mensaje;
  zona.appendChild(t);
  setTimeout(() => t.classList.add("visible"), 10);
  setTimeout(() => {
    t.classList.remove("visible");
    setTimeout(() => t.remove(), 300);
  }, 2200);
}
window.mostrarToast = mostrarToast;

/* ---------------- Validaciones de formularios ---------------- */

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function marcarError(input, mensaje) {
  input.classList.add("is-invalid");
  const fb = input.parentElement.querySelector(".invalid-feedback");
  if (fb && mensaje) fb.textContent = mensaje;
}
function limpiarError(input) {
  input.classList.remove("is-invalid");
}

function validarCampo(input) {
  const valor = input.value.trim();
  if (input.hasAttribute("required") && valor === "") {
    marcarError(input, "Este campo es obligatorio.");
    return false;
  }
  if (input.type === "email" && valor !== "" && !RE_CORREO.test(valor)) {
    marcarError(input, "Ingresá un correo válido (nombre@dominio.com).");
    return false;
  }
  if (input.type === "password" && valor !== "" && valor.length < 6) {
    marcarError(input, "La contraseña debe tener al menos 6 caracteres.");
    return false;
  }
  limpiarError(input);
  return true;
}

function validarFormulario(form) {
  let ok = true;
  form.querySelectorAll("input, textarea").forEach((campo) => {
    if (campo.type === "submit" || campo.type === "reset" || campo.type === "button")
      return;
    if (!validarCampo(campo)) ok = false;
  });
  return ok;
}

/* ---------------- Init: página de inicio ---------------- */

function initInicio() {
  cargarProductos();

  // Formulario de contacto embebido en la home (si existe).
  const formContacto = document.getElementById("formContacto");
  if (formContacto) ligarContacto(formContacto);
}

/* ---------------- Init: login ---------------- */

function initLogin() {
  const form = document.getElementById("formIngresar");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validarFormulario(form)) return;

    const correo = form.correo.value;
    const password = form.password.value;
    const aviso = document.getElementById("aviso-login");

    try {
      const sesion = await Auth.iniciarSesion(correo, password);
      if (aviso) {
        aviso.className = "alert alert-success";
        aviso.textContent = `¡Hola ${sesion.nombres}! Iniciando sesión...`;
      }
      setTimeout(() => (window.location.href = "../index.html"), 900);
    } catch (error) {
      if (aviso) {
        aviso.className = "alert alert-danger";
        aviso.textContent = error.message;
      }
    }
  });
}

/* ---------------- Init: registro ---------------- */

function initRegistro() {
  const form = document.getElementById("formRegistrarse");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validarFormulario(form)) return;

    const aviso = document.getElementById("aviso-registro");
    try {
      await Auth.registrar({
        nombres: form.nombres.value,
        apellidos: form.apellidos.value,
        edad: form.edad.value ? Number(form.edad.value) : null,
        correo: form.correo.value,
        password: form.password.value,
      });
      if (aviso) {
        aviso.className = "alert alert-success";
        aviso.textContent = "Cuenta creada. Ya podés iniciar sesión.";
      }
      form.reset();
      setTimeout(() => (window.location.href = "./ingresar.html"), 1200);
    } catch (error) {
      if (aviso) {
        aviso.className = "alert alert-danger";
        aviso.textContent = error.message;
      }
    }
  });
}

/* ---------------- Init: contacto (Formspree) ---------------- */

function ligarContacto(form) {
  // Validación en cliente; el envío real lo maneja Formspree.
  form.addEventListener("submit", (e) => {
    if (!validarFormulario(form)) {
      e.preventDefault();
    }
  });
  // Limpia el error apenas el usuario corrige el campo.
  form.querySelectorAll("input, textarea").forEach((campo) => {
    campo.addEventListener("input", () => validarCampo(campo));
  });
}

function initContacto() {
  const form = document.getElementById("formContacto");
  if (form) ligarContacto(form);
}

/* ---------------- Arranque común ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Estado de sesión + contador del carrito en cualquier página.
  if (window.pintarEstadoSesion) pintarEstadoSesion();
  if (window.Carrito) Carrito.refrescar();

  // Al cerrar sesión desde la NavBar, re-evaluar los botones "Agregar".
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => actualizarBotonesAgregar());
  }

  // Botón "Simular compra".
  const btnComprar = document.getElementById("btn-comprar");
  if (btnComprar) {
    btnComprar.addEventListener("click", async () => {
      const items = await DB.obtenerCarrito();
      if (items.length === 0) {
        mostrarToast("El carrito está vacío.");
        return;
      }
      if (!Auth.usuarioActivo()) {
        mostrarToast("Iniciá sesión para finalizar la compra.");
        return;
      }
      await Carrito.vaciar();
      mostrarToast("¡Compra simulada con éxito! Gracias por tu pedido.");
    });
  }

  // Init por página según los elementos presentes.
  if (document.getElementById("grilla-productos")) initInicio();
  if (document.getElementById("formIngresar")) initLogin();
  if (document.getElementById("formRegistrarse")) initRegistro();
  if (document.getElementById("formContacto") && !document.getElementById("grilla-productos"))
    initContacto();
});
