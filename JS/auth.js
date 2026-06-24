/* ============================================================
   auth.js  ·  Registro, login y sesión de usuarios
   ------------------------------------------------------------
   - Las cuentas se guardan de forma PERMANENTE en IndexedDB.
   - La sesión activa se guarda en sessionStorage, que el
     navegador borra al cerrar la pestaña: por eso el usuario
     queda deslogueado automáticamente al cerrar la pestaña.
   - Las contraseñas no se guardan en texto plano: se almacena
     su hash SHA-256.
   ============================================================ */

const CLAVE_SESION = "mg_sesion";

/**
 * Genera el hash SHA-256 de un texto (para no guardar la
 * contraseña en claro). Requiere contexto seguro: https o
 * localhost (ambos casos cubren Netlify y el server local).
 * @param {string} texto
 * @returns {Promise<string>} hash en hexadecimal
 */
async function hashear(texto) {
  const datos = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const Auth = {
  /**
   * Registra un usuario nuevo. Lanza error si el correo ya existe.
   * @param {{nombres:string, apellidos:string, edad:number, correo:string, password:string}} datos
   */
  async registrar(datos) {
    const existente = await DB.obtenerUsuario(datos.correo);
    if (existente) {
      throw new Error("Ya existe una cuenta con ese correo.");
    }
    const usuario = {
      nombres: datos.nombres.trim(),
      apellidos: (datos.apellidos || "").trim(),
      edad: datos.edad || null,
      correo: datos.correo.trim().toLowerCase(),
      password: await hashear(datos.password),
    };
    await DB.guardarUsuario(usuario);
    return usuario;
  },

  /**
   * Valida credenciales contra IndexedDB e inicia sesión.
   * @returns {Promise<{correo:string, nombres:string}>}
   */
  async iniciarSesion(correo, password) {
    const usuario = await DB.obtenerUsuario(correo.trim().toLowerCase());
    if (!usuario) {
      throw new Error("No existe una cuenta con ese correo.");
    }
    const hash = await hashear(password);
    if (hash !== usuario.password) {
      throw new Error("La contraseña es incorrecta.");
    }
    // Guardamos solo datos no sensibles en la sesión.
    const sesion = { correo: usuario.correo, nombres: usuario.nombres };
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    return sesion;
  },

  /** Cierra la sesión manualmente (botón de la NavBar). */
  cerrarSesion() {
    sessionStorage.removeItem(CLAVE_SESION);
  },

  /** Devuelve el usuario activo o null si no hay sesión. */
  usuarioActivo() {
    const dato = sessionStorage.getItem(CLAVE_SESION);
    return dato ? JSON.parse(dato) : null;
  },
};

window.Auth = Auth;

/* ------------------------------------------------------------
   Pinta el estado de sesión en la NavBar.
   Espera encontrar en el HTML:
     #nav-sesion       -> contenedor del enlace "Ingresar"
     #nav-usuario      -> contenedor con saludo + "Cerrar sesión"
     #nav-nombre       -> donde se escribe el nombre del usuario
     #btn-logout       -> botón para cerrar sesión
   ------------------------------------------------------------ */
function pintarEstadoSesion() {
  const usuario = Auth.usuarioActivo();
  const zonaIngresar = document.getElementById("nav-sesion");
  const zonaUsuario = document.getElementById("nav-usuario");
  const nombre = document.getElementById("nav-nombre");
  const btnLogout = document.getElementById("btn-logout");

  if (!zonaIngresar || !zonaUsuario) return; // página sin navbar de sesión

  if (usuario) {
    zonaIngresar.classList.add("d-none");
    zonaUsuario.classList.remove("d-none");
    if (nombre) nombre.textContent = usuario.nombres;
  } else {
    zonaIngresar.classList.remove("d-none");
    zonaUsuario.classList.add("d-none");
  }

  if (btnLogout && !btnLogout.dataset.ligado) {
    btnLogout.dataset.ligado = "1"; // evita ligar el evento dos veces
    btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      Auth.cerrarSesion();
      pintarEstadoSesion();
    });
  }
}

window.pintarEstadoSesion = pintarEstadoSesion;
