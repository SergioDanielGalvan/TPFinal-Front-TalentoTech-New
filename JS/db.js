/* ============================================================
   db.js  ·  Capa de acceso a IndexedDB
   ------------------------------------------------------------
   Mundo Gaming usa IndexedDB (en lugar de localStorage) para
   persistir datos entre sesiones. Define dos almacenes:
     - "usuarios": registro de cuentas para el login.
     - "carrito":  productos agregados al carrito de compras,
                   asociados al usuario dueño (carrito por usuario).
   Todas las funciones devuelven Promesas para poder usar
   async/await desde el resto de la aplicación.
   ============================================================ */

const DB_NOMBRE = "MundoGamingDB";
const DB_VERSION = 2; // v2: carrito por usuario (clave compuesta + índice)

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
      const versionPrevia = evento.oldVersion; // 0 si es instalación limpia

      if (!db.objectStoreNames.contains("usuarios")) {
        // El correo funciona como clave primaria (único por cuenta).
        db.createObjectStore("usuarios", { keyPath: "correo" });
      }

      // --- Migración del carrito a "carrito por usuario" ---
      // No se puede cambiar el keyPath de un store existente, así que
      // recreamos el store. Los ítems viejos (sin usuarioId) eran
      // huérfanos al no haber sesión, así que se descartan sin problema.
      if (versionPrevia < 2) {
        if (db.objectStoreNames.contains("carrito")) {
          db.deleteObjectStore("carrito");
        }
        // Clave compuesta: un mismo producto puede estar en el carrito
        // de varios usuarios, pero la dupla (usuarioId, id) es única.
        const carrito = db.createObjectStore("carrito", {
          keyPath: ["usuarioId", "id"],
        });
        // Índice para leer/contar solo los ítems de un usuario.
        carrito.createIndex("por_usuario", "usuarioId", { unique: false });
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

/**
 * Borra todos los ítems del carrito de un usuario en una sola
 * transacción (recorre el índice con un cursor). No usa conStore
 * porque el cursor dispara onsuccess varias veces.
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
async function vaciarCarritoUsuario(usuarioId) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("carrito", "readwrite");
    const indice = tx.objectStore("carrito").index("por_usuario");
    const req = indice.openCursor(IDBKeyRange.only(usuarioId));

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/* ---------- API pública ---------- */

const DB = {
  /* ----- USUARIOS ----- */

  // Guarda o reemplaza un usuario.
  guardarUsuario: (usuario) =>
    conStore("usuarios", "readwrite", (s) => s.put(usuario)),

  // Devuelve un usuario por su correo (o undefined si no existe).
  obtenerUsuario: (correo) =>
    conStore("usuarios", "readonly", (s) => s.get(correo)),

  /* ----- CARRITO (por usuario) ----- */

  // El item debe incluir el campo usuarioId.
  guardarItem: (item) =>
    conStore("carrito", "readwrite", (s) => s.put(item)),

  obtenerItem: (usuarioId, id) =>
    conStore("carrito", "readonly", (s) => s.get([usuarioId, id])),

  // Solo los ítems del usuario indicado.
  obtenerCarrito: (usuarioId) =>
    conStore("carrito", "readonly", (s) =>
      s.index("por_usuario").getAll(usuarioId)
    ),

  eliminarItem: (usuarioId, id) =>
    conStore("carrito", "readwrite", (s) => s.delete([usuarioId, id])),

  // Vacía únicamente el carrito de ese usuario.
  vaciarCarrito: (usuarioId) => vaciarCarritoUsuario(usuarioId),
};

// Disponible de forma global para el resto de los scripts.
window.DB = DB;
