const $ = (selector) => document.querySelector(selector);
const grid = $('#productGrid');
const categoryList = $('#categoryList');
const cart = new Map(JSON.parse(localStorage.getItem('lg-eventos-cart') || '[]'));
let activeCategory = 'Todo';
let toastTimer;

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
          <button class="product-image" data-add="${item.id}" aria-label="Agregar ${escapeHTML(item.name)} a la canasta">
            <img src="${item.image}" alt="${escapeHTML(item.name)} del catálogo Laura Galindo Eventos" loading="lazy" onerror="this.closest('.product-image').classList.add('image-fallback');this.remove()">
            <span class="image-add">+ Agregar</span><span class="image-index">LG · ${String(item.page).padStart(2, '0')}</span>
          </button>
          <div class="product-info"><div><span class="product-category">${escapeHTML(item.category)}</span><h3>${escapeHTML(item.name)}</h3></div><button class="add-button" data-add="${item.id}" aria-label="Agregar ${escapeHTML(item.name)}">+</button></div>
          <div class="product-price">Precio y disponibilidad <span>Por cotizar</span></div>
        </article>`).join('')}</div>
    </section>`).join('');
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function saveCart() {
  localStorage.setItem('lg-eventos-cart', JSON.stringify([...cart]));
  renderCart();
}

function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  saveCart();
  const item = products.find((product) => product.id === id);
  showToast(`${item.name} agregado a tu canasta`);
}

function renderCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  $('#cartCount').textContent = count;
  $('#drawerCount').textContent = `(${count})`;
  $('#cartEmpty').hidden = count > 0;
  $('#quoteForm').hidden = count === 0;
  $('#drawerFoot').hidden = count === 0;
  $('#startQuote').disabled = count === 0;
  $('#cartItems').innerHTML = [...cart.entries()].map(([id, quantity]) => {
    const item = products.find((product) => product.id === id);
    if (!item) return '';
    return `<article class="cart-item"><div class="cart-thumb"><img src="${item.image}" alt="" onerror="this.remove()"></div><div class="cart-item-copy"><span>${escapeHTML(item.category)}</span><h3>${escapeHTML(item.name)}</h3><small>Precio por confirmar</small><div class="quantity-controls"><button data-quantity="${id}" data-change="-1" aria-label="Quitar una unidad">−</button><b>${quantity}</b><button data-quantity="${id}" data-change="1" aria-label="Agregar una unidad">+</button><button class="remove-item" data-remove="${id}">Eliminar</button></div></div></article>`;
  }).join('');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

function setDrawer(open) {
  $('#cartDrawer').classList.toggle('open', open);
  $('#drawerBackdrop').classList.toggle('open', open);
  $('#cartDrawer').setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('drawer-open', open);
  if (open) $('#closeCart').focus();
}

function quoteMessage(formData) {
  const lines = [...cart.entries()].map(([id, quantity]) => {
    const item = products.find((product) => product.id === id);
    return item ? `• ${quantity} × ${item.name} (${item.category})` : null;
  }).filter(Boolean);
  const details = [
    `Hola, quisiera solicitar una cotización de ${window.CATALOG_CONFIG.businessName}.`, '',
    `Mi nombre: ${formData.get('name')}`,
    formData.get('date') ? `Fecha del evento: ${formData.get('date')}` : null,
    formData.get('city') ? `Ciudad: ${formData.get('city')}` : null,
    formData.get('notes') ? `Detalles: ${formData.get('notes')}` : null,
    '', 'Piezas seleccionadas:', ...lines, '',
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
  const button = event.target.closest('[data-add]');
  if (button) addToCart(button.dataset.add);
});
$('#cartItems').addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove]');
  if (remove) cart.delete(remove.dataset.remove);
  const control = event.target.closest('[data-quantity]');
  if (control) {
    const id = control.dataset.quantity;
    const next = (cart.get(id) || 0) + Number(control.dataset.change);
    if (next <= 0) cart.delete(id); else cart.set(id, next);
  }
  saveCart();
});

$('#openCart').addEventListener('click', () => setDrawer(true));
$('#closeCart').addEventListener('click', () => setDrawer(false));
$('#drawerBackdrop').addEventListener('click', () => setDrawer(false));
$('#continueShopping').addEventListener('click', () => setDrawer(false));
$('#startQuote').addEventListener('click', () => $('#quoteForm [name="name"]').focus());
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
