# Eventos_Laura_Galindo
Sitio estático para mostrar los productos del catálogo, filtrarlos por categoría, guardarlos en una canasta y preparar una solicitud de precios y disponibilidad.

## Abrir la página

Abre `index.html` en un navegador. No necesitas instalar programas ni iniciar un servidor para revisar el catálogo.

## Solicitudes directas por WhatsApp

El número del negocio ya está configurado en `config.js`. El formulario redacta un mensaje con los datos del evento y las piezas seleccionadas, y abre WhatsApp para enviarlo. El catálogo no publica tarifas ni inventario: cada cotización confirma esos datos según la fecha y los detalles del evento.

## Publicar en GitHub Pages

1. Integra la rama `codex/catalogo-web` en `main`.
2. En GitHub, abre **Settings → Pages**. En **Build and deployment**, elige **Deploy from a branch**, selecciona la rama `main` y la carpeta raíz `/`, y guarda.
3. GitHub mostrará la dirección pública de la página en esa misma sección cuando termine la publicación.

## Contenido

- `index.html`, `styles.css`: estructura y diseño adaptable a móvil.
- `catalogo.js`: categorías y nombres visibles en el PDF.
- `assets/products`: imágenes transparentes agrupadas por pieza desde el catálogo.
- `config.js`: nombre del negocio y número de WhatsApp para cotizaciones.

El PDF original se conserva en la carpeta de trabajo y se omite del repositorio para no subir el archivo de 78 MB. El repositorio original y su imagen se conservan.
