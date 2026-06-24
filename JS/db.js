/* ============================================================
   db.js  ·  Capa de acceso a IndexedDB
   ------------------------------------------------------------
   Mundo Gaming usa IndexedDB (en lugar de localStorage) para
   persistir datos entre sesiones. Define dos almacenes:
     - "usuarios": registro de cuentas para el login.
     - "carrito":  productos agregados al carrito de compras.
   Todas las funciones devuelven Promesas para poder usar
   async/await desde el resto de la aplicación.
   ============================================================ */

const DB_NOMBRE = "MundoGamingDB";
const DB_VERSION = 1;

/**
 * Abre (o crea) la base de datos y sus object stores.
 * @returns {Promise<IDBDatabase>}
 */
function abrirDB() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);

    // Se ejecuta solo cuando la BD no existe o cambia de versión.
    solicitud.onupgradeneeded = (evento) => {
      const db = evento.target.result;

      if (!db.objectStoreNames.contains("usuarios")) {
        // El correo funciona como clave primaria (único por cuenta).
        db.createObjectStore("usuarios", { keyPath: "correo" });
      }

      if (!db.objectStoreNames.contains("carrito")) {
        // Cada producto del carrito se identifica por su id.
        db.createObjectStore("carrito", { keyPath: "id" });
      }
    };

    solicitud.onsuccess = (evento) => resolve(evento.target.result);
    solicitud.onerror = (evento) =>
      reject(evento.target.error || new Error("No se pudo abrir IndexedDB"));
  });
}

/**
 * Helper genérico para ejecutar una operación dentro de una transacción.
 * @param {string} almacen  Nombre del object store.
 * @param {"readonly"|"readwrite"} modo
 * @param {(store: IDBObjectStore) => IDBRequest} operacion
 * @returns {Promise<any>}
 */
async function conStore(almacen, modo, operacion) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(almacen, modo);
    const store = tx.objectStore(almacen);
    const req = operacion(store);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/* ---------- API pública: USUARIOS ---------- */

const DB = {
  // Guarda o reemplaza un usuario.
  guardarUsuario: (usuario) =>
    conStore("usuarios", "readwrite", (s) => s.put(usuario)),

  // Devuelve un usuario por su correo (o undefined si no existe).
  obtenerUsuario: (correo) =>
    conStore("usuarios", "readonly", (s) => s.get(correo)),

  /* ---------- API pública: CARRITO ---------- */

  guardarItem: (item) =>
    conStore("carrito", "readwrite", (s) => s.put(item)),

  obtenerItem: (id) =>
    conStore("carrito", "readonly", (s) => s.get(id)),

  obtenerCarrito: () =>
    conStore("carrito", "readonly", (s) => s.getAll()),

  eliminarItem: (id) =>
    conStore("carrito", "readwrite", (s) => s.delete(id)),

  vaciarCarrito: () =>
    conStore("carrito", "readwrite", (s) => s.clear()),
};

// Disponible de forma global para el resto de los scripts.
window.DB = DB;
