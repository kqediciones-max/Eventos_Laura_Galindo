const $ = (selector) => document.querySelector(selector);
const grid = $('#productGrid');
const categoryList = $('#categoryList');
const cart = new Map(JSON.parse(localStorage.getItem('lg-eventos-cart') || '[]'));
const eventOptions = [
  { id: 'event-bodas', name: 'Bodas', category: 'Cotización de eventos', image: 'assets/hero-event.jpg' },
  { id: 'event-sociales', name: 'Eventos sociales', category: 'Cotización de eventos', image: 'assets/events/carrito-de-torta.jpg' },
  { id: 'event-corporativos', name: 'Eventos corporativos', category: 'Cotización de eventos', image: 'assets/events/mesa-cristaleria.jpg' },
  { id: 'event-quince', name: 'Quince años', category: 'Cotización de eventos', image: 'assets/events/ambientacion-quince.jpg' }
];
let activeCategory = 'Todo';
let toastTimer;
let previewTrigger = null;

const eventWhatsAppNumber = (window.CATALOG_CONFIG.whatsappNumber || '').replace(/\D/g, '');
const eventWhatsAppText = 'Hola, quiero cotizar la planeación de un evento a mi medida. Cuéntame cómo podemos organizarlo.';
document.querySelectorAll('[data-event-quote]').forEach((link) => {
  if (eventWhatsAppNumber) {
    link.href = `https://wa.me/${eventWhatsAppNumber}?text=${encodeURIComponent(eventWhatsAppText)}`;
  } else {
    link.href = '#catalogo';
    link.removeAttribute('target');
  }
});

function renderCategories() {
  categoryList.innerHTML = categories.map((category) => `<button class="category-chip ${category === activeCategory ? 'active' : ''}" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('');
}

function filteredProducts() {
  const query = $('#searchInput').value.trim().toLocaleLowerCase('es');
  return products.filter((item) => (activeCategory === 'Todo' || item.category === activeCategory)
    && (!query || `${item.name} ${item.category}`.toLocaleLowerCase('es').includes(query)));
}

function renderProducts() {
  const visible = filteredProducts();
  $('#resultCount').textContent = `${visible.length} ${visible.length === 1 ? 'pieza' : 'piezas'}`;
  $('#emptyState').hidden = visible.length > 0;
  const groups = [];
  for (const item of visible) {
    const title = item.sectionTitle || item.category;
    const key = `${item.category}:${title}`;
    if (!groups.length || groups.at(-1).key !== key) groups.push({ key, title, items: [] });
    groups.at(-1).items.push(item);
  }
  grid.innerHTML = groups.map((group) => `
    <section class="product-section">
      <div class="product-section-heading"><h3>${escapeHTML(group.title)}</h3><span>${group.items.length} ${group.items.length === 1 ? 'pieza' : 'piezas'}</span></div>
      <div class="product-grid-inner">${group.items.map((item) => `
        <article class="product-card">
          <div class="product-image">
            ${catalogImage(item, `${escapeHTML(item.name)} del catálogo Laura Galindo Eventos`)}
            <span class="image-index">LG · ${String(item.page).padStart(2, '0')}</span>
            <div class="image-actions"><button class="image-preview-trigger" type="button" data-preview="${item.id}" aria-label="Ver imagen de ${escapeHTML(item.name)}">Vista previa</button><button class="image-add" type="button" data-add="${item.id}" aria-label="Agregar ${escapeHTML(item.name)} a la canasta">+ Agregar</button></div>
          </div>
          <div class="product-info"><div><span class="product-category">${escapeHTML(item.category)}</span><h3>${escapeHTML(item.name)}</h3></div><button class="add-button" data-add="${item.id}" aria-label="Agregar ${escapeHTML(item.name)}">+</button></div>
          <div class="product-price">Precio y disponibilidad <span>Por cotizar</span></div>
        </article>`).join('')}</div>
    </section>`).join('');
  initializeCroppedImages(grid);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function catalogImage(item, alt) {
  if (item.imageParts?.length === 1) {
    return `<img class="${item.imageFlipped ? 'is-flipped' : ''}" src="${escapeHTML(item.imageParts[0])}" alt="${alt}" loading="lazy" onerror="this.closest('.product-image')?.classList.add('image-fallback');this.remove()">`;
  }
  if (item.imageParts?.length > 1) {
    const columns = item.imageParts.length === 2 ? 2 : Math.ceil(Math.sqrt(item.imageParts.length));
    const rows = Math.ceil(item.imageParts.length / columns);
    const images = item.imageParts.map((src) => `<img src="${escapeHTML(src)}" alt="" loading="lazy" onerror="this.remove()">`).join('');
    return `<span class="product-part-grid ${item.imageParts.length === 2 ? 'is-pair' : ''}" role="img" aria-label="${alt}" style="--part-columns:${columns};--part-rows:${rows}">${images}</span>`;
  }
  if (item.imageCrop) {
    const { x, y, width, height, targetWidth = width, targetHeight = height } = item.imageCrop;
    return `<span class="product-crop-window"><canvas width="${targetWidth}" height="${targetHeight}" data-source="${escapeHTML(item.image)}" data-crop='{"x":${x},"y":${y},"width":${width},"height":${height}}' role="img" aria-label="${alt}"></canvas></span>`;
  }
  return `<img class="${item.imageFlipped ? 'is-flipped' : ''}" src="${escapeHTML(item.image)}" alt="${alt}" loading="lazy" onerror="this.closest('.product-image')?.classList.add('image-fallback');this.remove()">`;
}

function initializeCroppedImages(container) {
  container.querySelectorAll('canvas[data-source]').forEach((canvas) => {
    const image = new Image();
    image.onload = () => {
      const { x, y, width, height } = JSON.parse(canvas.dataset.crop);
      const scale = Math.min(canvas.width / width, canvas.height / height);
      const drawWidth = width * scale;
      const drawHeight = height * scale;
      const offsetX = (canvas.width - drawWidth) / 2;
      const offsetY = (canvas.height - drawHeight) / 2;
      canvas.getContext('2d').drawImage(image, x, y, width, height, offsetX, offsetY, drawWidth, drawHeight);
    };
    image.onerror = () => {
      canvas.closest('.product-image')?.classList.add('image-fallback');
      canvas.remove();
    };
    image.src = canvas.dataset.source;
  });
}

function saveCart() {
  localStorage.setItem('lg-eventos-cart', JSON.stringify([...cart]));
  renderCart();
}

function quoteItem(id) {
  return products.find((product) => product.id === id) || eventOptions.find((eventOption) => eventOption.id === id);
}

function addToCart(id) {
  const item = quoteItem(id);
  if (!item) return;
  const quantity = (cart.get(id) || 0) + 1;
  cart.set(id, quantity);
  saveCart();
  showToast(`Agregado: ${item.name} · ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} en tu canasta`);
}

function addEventToCart(id) {
  addToCart(id);
  setDrawer(true);
}

function renderCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  $('#cartCount').textContent = count;
  $('#drawerCount').textContent = `(${count})`;
  $('#cartEmpty').hidden = count > 0;
  $('#quoteForm').hidden = count === 0;
  $('#cartItems').innerHTML = [...cart.entries()].map(([id, quantity]) => {
    const item = quoteItem(id);
    if (!item) return '';
    return `<article class="cart-item"><div class="cart-thumb">${catalogImage(item, '')}</div><div class="cart-item-copy"><span>${escapeHTML(item.category)}</span><h3>${escapeHTML(item.name)}</h3><small>Precio por confirmar</small><div class="quantity-controls"><label for="quantity-${id}">Cantidad</label><input id="quantity-${id}" class="quantity-input" type="number" min="1" step="1" inputmode="numeric" value="${quantity}" data-quantity="${id}" aria-label="Cantidad de ${escapeHTML(item.name)}"><button class="remove-item" data-remove="${id}">Eliminar</button></div></div></article>`;
  }).join('');
  initializeCroppedImages($('#cartItems'));
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function setDrawer(open) {
  $('#cartDrawer').classList.toggle('open', open);
  $('#drawerBackdrop').classList.toggle('open', open);
  $('#cartDrawer').setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('drawer-open', open);
  if (open) {
    $('#cartFlow').scrollTop = 0;
    $('#closeCart').focus();
  }
}

function quoteMessage(formData) {
  const lines = [...cart.entries()].map(([id, quantity]) => {
    const item = quoteItem(id);
    return item ? `• ${quantity} × ${item.name} (${item.category})` : null;
  }).filter(Boolean);
  const details = [
    `Hola, quisiera solicitar una cotización de ${window.CATALOG_CONFIG.businessName}.`, '',
    `Mi nombre: ${formData.get('name')}`,
    formData.get('date') ? `Fecha del evento: ${formData.get('date')}` : null,
    formData.get('city') ? `Ciudad: ${formData.get('city')}` : null,
    formData.get('notes') ? `Detalles: ${formData.get('notes')}` : null,
    '', 'Selección para cotizar:', ...lines, '',
    'Por favor, confírmenme precios y disponibilidad. ¡Gracias!'
  ];
  return details.filter((line) => line !== null).join('\n');
}

categoryList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderProducts();
});

$('#searchInput').addEventListener('input', renderProducts);
grid.addEventListener('click', (event) => {
  const preview = event.target.closest('[data-preview]');
  if (preview) {
    const item = products.find((product) => product.id === preview.dataset.preview);
    if (!item) return;
    previewTrigger = preview;
    $('#previewCategory').textContent = item.category;
    $('#previewTitle').textContent = item.name;
    $('#imagePreviewContent').innerHTML = `<div class="product-image preview-image-stage">${catalogImage(item, `${escapeHTML(item.name)} del catálogo Laura Galindo Eventos`)}</div>`;
    initializeCroppedImages($('#imagePreviewContent'));
    $('#imagePreview').showModal();
    $('#closeImagePreview').focus();
    return;
  }
  const button = event.target.closest('[data-add]');
  if (button) addToCart(button.dataset.add);
});
$('#eventTypes').addEventListener('click', (event) => {
  const button = event.target.closest('[data-event-add]');
  if (button) addEventToCart(button.dataset.eventAdd);
});
$('#closeImagePreview').addEventListener('click', () => $('#imagePreview').close());
$('#imagePreview').addEventListener('click', (event) => {
  if (event.target === $('#imagePreview')) $('#imagePreview').close();
});
$('#imagePreview').addEventListener('close', () => {
  previewTrigger?.focus();
  previewTrigger = null;
});
$('#cartItems').addEventListener('change', (event) => {
  const input = event.target.closest('[data-quantity]');
  if (!input) return;
  const id = input.dataset.quantity;
  const next = Number(input.value);
  if (!Number.isInteger(next) || next < 1) {
    input.value = cart.get(id) || 1;
    return;
  }
  cart.set(id, next);
  localStorage.setItem('lg-eventos-cart', JSON.stringify([...cart]));
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  $('#cartCount').textContent = count;
  $('#drawerCount').textContent = `(${count})`;
});
$('#cartItems').addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove]');
  if (!remove) return;
  cart.delete(remove.dataset.remove);
  saveCart();
});

$('#openCart').addEventListener('click', () => setDrawer(true));
$('#closeCart').addEventListener('click', () => setDrawer(false));
$('#drawerBackdrop').addEventListener('click', () => setDrawer(false));
$('#continueShopping').addEventListener('click', () => setDrawer(false));
$('#quoteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = quoteMessage(new FormData(event.currentTarget));
  const number = (window.CATALOG_CONFIG.whatsappNumber || '').replace(/\D/g, '');
  if (number) {
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    await navigator.clipboard.writeText(message);
    showToast('Solicitud copiada. Configura el WhatsApp del negocio para abrir el chat directo.');
    $('#contactHint').textContent = 'Tu mensaje quedó copiado. Configura el número del negocio en config.js para enviarlo directamente por WhatsApp.';
  } catch {
    $('#contactHint').textContent = message;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setDrawer(false);
});

if (!window.CATALOG_CONFIG.whatsappNumber) {
  $('#contactHint').textContent = 'Configura el WhatsApp del negocio en config.js para habilitar el envío directo.';
}
$('#year').textContent = new Date().getFullYear();
renderCategories();
renderProducts();
renderCart();
