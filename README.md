# Laura Galindo Eventos

Catálogo web para alquiler de mobiliario y planeación de eventos. El cliente puede preparar una solicitud, abrirla en WhatsApp y, cuando el sitio se despliega en Vercel con Supabase configurado, guardarla en una bandeja privada para los administradores.

## Desarrollo local

- Catálogo estático: abre `index.html` en un navegador.
- Panel: requiere Vercel Functions y variables de entorno. Instala Vercel CLI (`npm install --global vercel`) e inicia con `npm run dev` después de crear `.env.local` a partir de `.env.example`.

## Configuración de administración y solicitudes

GitHub Pages solo publica archivos estáticos; no ejecuta las funciones de autenticación ni la API. Para usar el panel de cotizaciones y guardar solicitudes, despliega el repositorio en Vercel y conecta un proyecto de Supabase.

1. En Supabase, abre SQL Editor y ejecuta `database/schema.sql`. Si ya habías creado las tablas, ejecútalo de nuevo para agregar los nuevos campos de cliente, vigencia y totales.
2. En Vercel, conecta este repositorio y agrega las variables de `.env.example` en **Project Settings → Environment Variables**. Completa la URL del proyecto, la clave secreta del proyecto Supabase (`sb_secret_…`), una clave de sesión aleatoria de 32 o más caracteres y las claves de administración. La clave secreta, las claves de administración y la clave de sesión son secretos del servidor: nunca las agregues a `config.js`, archivos públicos ni al repositorio.
3. Configura las claves iniciales de los dos administradores directamente como variables privadas de Vercel. Para cambiar claves, actualiza las variables y vuelve a desplegar.
4. Publica el proyecto en Vercel y usa ese dominio como sitio principal para que `/api/login`, `/api/admin` y `/api/requests` estén disponibles.

El acceso del panel está en `/admin.html`. La sesión se firma en el servidor y se conserva en una cookie `HttpOnly`; las contraseñas no están incluidas en el frontend. Las solicitudes solo se guardan si el navegador llega al sitio de Vercel con el backend configurado. Sin ese backend, el catálogo sigue ofreciendo el flujo de WhatsApp.

## Flujo del administrador

- Revisa solicitudes recibidas, sus datos de evento y productos seleccionados.
- Crea una cotización nueva o desde una solicitud, agregando productos del catálogo, cantidades, precios, comentarios y datos del cliente.
- Decide si aplica un impuesto por cotización: IVA del 5%, IVA del 19% o impuesto al consumo del 8%. Si no seleccionas un impuesto, el documento no muestra una fila de impuestos.
- Guarda la cotización para conservarla en el historial.
- Elimina cotizaciones del historial; si una solicitud ya no tiene cotizaciones vinculadas, vuelve a quedar pendiente.
- **Ver cotización** abre una vista previa formal dentro del panel. Desde allí puedes imprimir o elegir “Guardar como PDF”. El formato incluye el logo, NIT, teléfonos, dirección, datos del cliente, validez, detalle, totales, condiciones comerciales y espacios de firma.
- Abre WhatsApp para enviar el archivo descargado al cliente.

## Archivos principales

- `index.html`, `styles.css`, `home.css`: sitio público.
- `catalogo.js`: productos y categorías usados por el catálogo y el cotizador.
- `admin.html`, `admin.css`, `admin.js`: acceso y panel de cotizaciones.
- `api/`: funciones de Vercel para sesión, solicitudes y administración.
- `lib/server.js`: sesiones, validación y acceso del servidor a Supabase.
- `database/schema.sql`: tablas privadas para solicitudes y cotizaciones.
- `config.js`: información pública del negocio y número de WhatsApp.

El PDF original se conserva localmente y está excluido del repositorio por su tamaño. El logo se sirve desde `assets`.
