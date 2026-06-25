# Mundo Gaming · Proyecto Final Front End (Talento Tech)

E-commerce de hardware gamer (placas madre AORUS, tarjetas de video AORUS y
gabinetes Thermaltake). El sitio consume los productos desde una API REST con
`fetch`, los muestra como cards y permite agregarlos a un carrito de compras
con persistencia entre sesiones. Incluye registro/login de usuarios, formularios
validados y un tema visual gamer oscuro construido sobre Bootstrap 5.

Autor: **Sergio Daniel Galván**

---

## Funcionalidades

- **Catálogo dinámico**: los productos se cargan desde `datos/productos.json`
  con `fetch()` y se renderizan en el DOM como cards (imagen, categoría, specs,
  precio y enlace al fabricante).
- **Productos destacados**: una fila curada (1 por categoría) arriba del
  catálogo completo. Se controla con el flag `destacado` en el JSON.
- **Carrito de compras**: agregar productos, contador en tiempo real, edición
  de cantidades, eliminación, total dinámico, "Simular compra" y "Borrar
  carrito" (con confirmación).
- **Agregar solo con sesión**: el botón "Agregar al carrito" está deshabilitado
  hasta que el usuario inicia sesión.
- **Registro e inicio de sesión** de usuarios, con validación.
- **Cierre de sesión**: desde el botón de la NavBar **o** automáticamente al
  cerrar la pestaña del navegador.
- **Cotización del dólar** en la NavBar (dólar oficial, vía API con CORS).
- **Formularios validados** (contacto y soporte) con feedback en el cliente;
  envío vía **Formspree**.
- **Diseño responsivo** con **Bootstrap 5**, Flexbox, Grid y Media Queries.
- **Identidad visual propia**: logo SVG (gamepad), carrusel de imágenes,
  carrusel animado de marcas y paleta RGB cian→magenta.
- **SEO y accesibilidad**: metaetiquetas, `alt` en imágenes, foco visible,
  navegación por teclado y `prefers-reduced-motion`.

---

## Stack

- HTML5 semántico (`header`, `nav`, `main`, `section`, `footer`).
- CSS propio (`estilos-final.css`) sobre **Bootstrap 5** (vía CDN).
- JavaScript vanilla (sin frameworks ni build).
- **IndexedDB** para persistencia, `sessionStorage` para la sesión.
- Google Fonts: Chakra Petch (títulos) e Inter (texto).

---

## Estructura del proyecto

```
TPFinal-Front-TalentoTech/
├─ index.html              Home: marcas, slice, hero, destacados, catálogo,
│                          reseñas, contacto y carrito
├─ datos/
│  └─ productos.json       "API REST" local (fuente de verdad de los productos)
├─ CSS/
│  ├─ estilos-final.css    Tema gamer + componentes sobre Bootstrap
│  ├─ estilos.css          (legado de la pre-entrega; lo usan mothers/videocards/gabinetes)
│  ├─ slice.css            (legado)
│  └─ sliderlogos.css      (legado)
├─ JS/
│  ├─ db.js                Wrapper de IndexedDB (usuarios + carrito)
│  ├─ auth.js              Registro / login / logout / estado de sesión
│  ├─ carrito.js           Lógica del carrito de compras
│  ├─ app.js               Orquestador: fetch, render, validaciones e init
│  ├─ productos-data.js    Copia embebida del catálogo (respaldo para file://)
│  ├─ tc.js                Cotización del dólar para la NavBar
│  └─ codigo.js            (legado, vacío; sin uso en la versión final)
├─ Paginas/
│  ├─ ingresar.html        Login
│  ├─ registrase.html      Registro
│  ├─ contacto.html        Contacto (Formspree)
│  ├─ acerca.html          Quiénes somos + mapa
│  ├─ soporte.html         Ticket de soporte técnico
│  ├─ mothers.html         Catálogo placas madre (pendiente de migrar)
│  ├─ videocards.html      Catálogo placas de video (pendiente de migrar)
│  └─ gabinetes.html       Catálogo gabinetes (pendiente de migrar)
└─ imagenes/               Productos, logos de marcas y logo-mg.svg
```

---

## Archivos JavaScript (detalle)

El código está dividido en módulos por responsabilidad. Se cargan en este orden
(cada uno expone lo que necesita en `window`, no hay sistema de imports):

`db.js` → `auth.js` → `carrito.js` → `productos-data.js` → `tc.js` → `app.js`

### `db.js` — Capa de datos (IndexedDB)
Abre/crea la base `MundoGamingDB` con dos *object stores* y expone un objeto
global `DB` con métodos basados en Promesas:
- `usuarios` (clave: `correo`): cuentas registradas.
- `carrito` (clave: `id`): productos agregados.
- Métodos: `guardarUsuario`, `obtenerUsuario`, `guardarItem`, `obtenerItem`,
  `obtenerCarrito`, `eliminarItem`, `vaciarCarrito`.
Todo el acceso a la base pasa por acá; el resto de los módulos no tocan
IndexedDB directamente.

### `auth.js` — Autenticación y sesión
Objeto global `Auth` con la lógica de cuentas:
- `registrar(datos)`: valida que el correo no exista y guarda el usuario (la
  contraseña se almacena **hasheada con SHA-256** vía SubtleCrypto, nunca en
  texto plano).
- `iniciarSesion(correo, password)`: compara el hash y guarda la sesión en
  `sessionStorage` (por eso se cierra sola al cerrar la pestaña).
- `cerrarSesion()` y `usuarioActivo()`.
- `pintarEstadoSesion()`: actualiza la NavBar (muestra "Ingresar" o el saludo +
  "Cerrar sesión") según haya sesión.

### `carrito.js` — Carrito de compras
Objeto global `Carrito`, persiste todo en IndexedDB:
- `agregar(producto)`, `cambiarCantidad(id, delta)`, `eliminar(id)`, `vaciar()`.
- `total(items)` y `cantidadTotal(items)` para el dinero y el contador.
- `refrescar()`: relee la base y redibuja contador y lista.
- `pintarContador()` y `pintarLista()`: renderizan la burbuja de la NavBar y el
  detalle dentro del offcanvas (con botones +/− y eliminar).
- Helper `formatearPrecio()` (formato USD).

### `app.js` — Orquestador
Es el "pegamento" de la aplicación:
- **Productos**: `cargarProductos()` hace `fetch` a `datos/productos.json`
  (con respaldo a `productos-data.js` si falla), y `renderProductos()` arma las
  cards en las grillas de destacados y catálogo. El botón "Agregar" se renderiza
  deshabilitado si no hay sesión (`actualizarBotonesAgregar()`).
- **Validaciones**: `validarCampo` / `validarFormulario` (requeridos, formato de
  correo, largo mínimo de contraseña) con feedback de Bootstrap.
- **Init por página**: detecta qué elementos existen y arranca lo que
  corresponde (`initInicio`, `initLogin`, `initRegistro`, `initContacto`,
  `initSoporte`).
- **Botones globales**: "Simular compra" y "Borrar carrito".
- `mostrarToast()`: avisos no intrusivos.

### `productos-data.js` — Respaldo del catálogo
Copia embebida del catálogo en `window.PRODUCTOS_FALLBACK`. Se usa **solo** si
el `fetch` falla (típico al abrir con `file://`, donde el navegador bloquea la
lectura de archivos locales). La fuente de verdad sigue siendo
`datos/productos.json`.

### `tc.js` — Cotización del dólar
`cargarTipoCambio()` consulta `dolarapi.com` (JSON + CORS) y muestra el dólar
oficial en la NavBar (con compra/venta en el `title`). Si falla, oculta el aviso
para no romper la barra. (Ver nota sobre AFIP/PHP más abajo.)

### `codigo.js` — Legado
Archivo vacío que venía de la pre-entrega. No se usa en la versión final; se
puede borrar.

---

## Persistencia: IndexedDB (mejora sobre la consigna)

La consigna pedía `localStorage`/`sessionStorage`. Este proyecto usa
**IndexedDB** para los datos persistentes (más robusta y pensada para
almacenamiento estructurado): el almacén `usuarios` guarda las cuentas (con
contraseñas hasheadas en SHA-256) y `carrito` guarda los productos, que
sobreviven a recargas y cierres del navegador. La **sesión activa** va en
`sessionStorage`, que el navegador borra al cerrar la pestaña.

---

## Cómo correrlo

`fetch` e IndexedDB requieren servir la página por HTTP (no `file://`):

- **VS Code**: extensión *Live Server* → "Open with Live Server".
- **Python**: `python -m http.server` y abrir `http://localhost:8000`.
- **Producción**: subir a Netlify o GitHub Pages.

Si abrís `index.html` con doble clic (file://), el navegador bloquea `fetch`. La
app lo detecta y carga los productos desde `JS/productos-data.js` para que igual
se vean. Si editás precios en el JSON y querés que el doble clic los refleje,
regenerá ese archivo (o editá ambos).

---

## Configurables / pendientes

- **Precios y URLs**: en `datos/productos.json`. Cada card enlaza al sitio del
  fabricante (Gigabyte / AORUS / Thermaltake).
- **Formspree**: reemplazá la URL `action` (contacto y soporte) por la de tu
  cuenta.
- **Cotización del dólar**: `tc.js` usa `dolarapi.com`. La clase PHP original
  hacía scraping de AFIP con `curl`; eso no es portable al navegador por **CORS**
  (AFIP no devuelve JSON ni habilita CORS). Si deployás con hosting PHP, podés
  exponer esa clase como endpoint propio (mismo origen) y cambiar `TC_API` en
  `tc.js` por esa URL.
- **Migración pendiente**: `mothers.html`, `videocards.html` y `gabinetes.html`
  todavía usan el estilo de la pre-entrega.

---

## Estado de la migración al nuevo look

| Página            | Estado            |
|-------------------|-------------------|
| index.html        | ✅ Migrada         |
| acerca.html       | ✅ Migrada         |
| contacto.html     | ✅ Migrada         |
| ingresar.html     | ✅ Migrada         |
| registrase.html   | ✅ Migrada         |
| soporte.html      | ✅ Migrada         |
| mothers.html      | ⏳ Pendiente       |
| videocards.html   | ⏳ Pendiente       |
| gabinetes.html    | ⏳ Pendiente       |
