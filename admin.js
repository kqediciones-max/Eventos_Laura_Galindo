const $ = (selector, root = document) => root.querySelector(selector);
const loginScreen = $('#loginScreen');
const adminApp = $('#adminApp');
const loginForm = $('#loginForm');
const quoteBuilder = $('#quoteBuilder');
const quoteLines = $('#quoteLines');
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
let requestRows = [];
let quoteRows = [];
let activeUser = null;
let lastSavedQuote = null;

function feedback(target, message, isError = false) {
  target.textContent = message;
  target.classList.toggle('is-error', isError);
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error ${response.status}. Revisa la configuración del servidor.`);
  return payload;
}

function showAdmin(user) {
  activeUser = user;
  loginScreen.hidden = true;
  adminApp.hidden = false;
  $('#logoutButton').hidden = false;
  $('#adminName').textContent = user.name;
}

async function checkSession() {
  try {
    const data = await api('/api/admin');
    showAdmin(data.user);
    requestRows = data.requests || [];
    quoteRows = data.quotes || [];
    renderLists();
  } catch (error) {
    if (error.message && !error.message.includes('401') && !error.message.includes('404')) {
      feedback($('#loginFeedback'), error.message, true);
    } else if (error.message.includes('404')) {
      feedback($('#loginFeedback'), 'El panel requiere publicar esta página en Vercel y conectar su backend.', true);
    }
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  feedback($('#loginFeedback'), 'Verificando acceso…');
  const data = Object.fromEntries(new FormData(loginForm));
  try {
    const result = await api('/api/login', { method: 'POST', body: JSON.stringify(data) });
    loginForm.reset();
    feedback($('#loginFeedback'), '');
    showAdmin(result.user);
    await loadData();
  } catch (error) {
    feedback($('#loginFeedback'), error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#logoutButton').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch {}
  activeUser = null;
  requestRows = [];
  quoteRows = [];
  adminApp.hidden = true;
  $('#logoutButton').hidden = true;
  loginScreen.hidden = false;
  feedback($('#loginFeedback'), 'Sesión cerrada.');
});

async function loadData() {
  try {
    const data = await api('/api/admin');
    requestRows = data.requests || [];
    quoteRows = data.quotes || [];
    renderLists();
    feedback($('#pageFeedback'), 'Información actualizada.');
  } catch (error) {
    feedback($('#pageFeedback'), error.message, true);
  }
}

$('#refreshButton').addEventListener('click', loadData);

function statusLabel(status) {
  return ({ pending: 'Pendiente', quoted: 'Cotizada', closed: 'Cerrada' })[status] || 'Pendiente';
}

function formatDate(value) {
  if (!value) return 'Por definir';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(parsed);
}

function renderRequests() {
  const list = $('#requestList');
  list.replaceChildren();
  $('#pendingCount').textContent = requestRows.filter((row) => row.status === 'pending').length;
  $('#answeredCount').textContent = requestRows.filter((row) => row.status === 'quoted').length;
  if (!requestRows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-note';
    empty.textContent = 'Todavía no hay solicitudes registradas.';
    list.append(empty);
    return;
  }
  for (const row of requestRows) {
    const card = document.createElement('article');
    card.className = 'request-card';
    card.dataset.requestId = row.id;
    const head = document.createElement('div');
    head.className = 'request-card-head';
    const title = document.createElement('h3');
    title.textContent = row.customer_name || 'Cliente';
    const badge = document.createElement('span');
    badge.className = `status-badge ${row.status || 'pending'}`;
    badge.textContent = statusLabel(row.status);
    head.append(title, badge);
    const meta = document.createElement('p');
    meta.textContent = `${formatDate(row.event_date)} · ${row.city || 'Ciudad por confirmar'}${row.phone ? ` · WhatsApp ${row.phone}` : ''}`;
    const items = document.createElement('div');
    items.className = 'request-card-items';
    items.textContent = (row.items || []).map((item) => `${item.quantity} × ${item.name}`).join(' · ') || 'Sin ítems indicados';
    const actions = document.createElement('div');
    actions.className = 'request-card-actions';
    const respond = document.createElement('button');
    respond.type = 'button';
    respond.className = 'admin-button admin-button-outline';
    respond.textContent = 'Preparar respuesta';
    respond.addEventListener('click', () => prepareFromRequest(row));
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'admin-button admin-button-quiet';
    close.textContent = row.status === 'closed' ? 'Reabrir' : 'Cerrar';
    close.addEventListener('click', () => updateRequestStatus(row, row.status === 'closed' ? 'pending' : 'closed'));
    actions.append(respond, close);
    card.append(head, meta, items);
    if (row.notes) {
      const notes = document.createElement('p');
      notes.textContent = `Detalle: ${row.notes}`;
      card.append(notes);
    }
    card.append(actions);
    list.append(card);
  }
}

function renderQuotes() {
  const list = $('#quoteList');
  list.replaceChildren();
  $('#quoteCount').textContent = quoteRows.length;
  if (!quoteRows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-note';
    empty.textContent = 'Aún no hay cotizaciones guardadas.';
    list.append(empty);
    return;
  }
  for (const quote of quoteRows) {
    const card = document.createElement('article');
    card.className = 'quote-card';
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = quote.recipient_name;
    const details = document.createElement('p');
    details.textContent = `${quote.quote_number} · ${money.format(Number(quote.total) || 0)} · ${formatDate(quote.created_at)}`;
    copy.append(title, details);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-button admin-button-outline';
    button.textContent = 'Ver PDF';
    button.addEventListener('click', () => printQuote(quote));
    card.append(copy, button);
    list.append(card);
  }
}

function renderLists() {
  renderRequests();
  renderQuotes();
}

async function updateRequestStatus(row, status) {
  try {
    await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'status', requestId: row.id, status }) });
    await loadData();
  } catch (error) {
    feedback($('#pageFeedback'), error.message, true);
  }
}

function productOptions(selectedId = '') {
  return [...products, ...eventOptions].map((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} · ${item.category}`;
    if (item.id === selectedId) option.selected = true;
    return option;
  });
}

function addQuoteLine(item = {}) {
  const row = document.createElement('div');
  row.className = 'quote-line';
  const itemLabel = document.createElement('label');
  itemLabel.className = 'item-select';
  itemLabel.textContent = 'Ítem';
  const select = document.createElement('select');
  select.dataset.field = 'product';
  select.required = true;
  const initial = document.createElement('option');
  initial.value = '';
  initial.textContent = 'Seleccionar del catálogo';
  select.append(initial, ...productOptions(item.id || ''));
  itemLabel.append(select);

  const quantityLabel = document.createElement('label');
  quantityLabel.className = 'quantity-label';
  quantityLabel.textContent = 'Cantidad';
  const quantity = document.createElement('input');
  quantity.type = 'number';
  quantity.min = '1';
  quantity.step = '1';
  quantity.value = String(item.quantity || 1);
  quantity.dataset.field = 'quantity';
  quantity.required = true;
  quantityLabel.append(quantity);

  const priceLabel = document.createElement('label');
  priceLabel.className = 'unit-label';
  priceLabel.textContent = 'Valor unitario (COP)';
  const price = document.createElement('input');
  price.type = 'number';
  price.min = '0';
  price.step = '1000';
  price.value = item.unitPrice === undefined ? '' : String(item.unitPrice);
  price.placeholder = 'Por definir';
  price.dataset.field = 'price';
  price.required = true;
  priceLabel.append(price);

  const noteLabel = document.createElement('label');
  noteLabel.className = 'line-comment';
  noteLabel.textContent = 'Comentario del ítem';
  const note = document.createElement('input');
  note.type = 'text';
  note.maxLength = 500;
  note.value = item.comment || '';
  note.placeholder = 'Opcional';
  note.dataset.field = 'comment';
  noteLabel.append(note);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-line';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'Quitar este ítem');
  remove.addEventListener('click', () => { row.remove(); updateTotal(); });
  row.append(itemLabel, quantityLabel, priceLabel, noteLabel, remove);
  for (const control of row.querySelectorAll('input,select')) control.addEventListener('input', updateTotal);
  quoteLines.append(row);
  updateTotal();
  return row;
}

function selectedCatalogItem(select) {
  return [...products, ...eventOptions].find((item) => item.id === select.value);
}

function updateTotal() {
  let total = 0;
  for (const line of quoteLines.querySelectorAll('.quote-line')) {
    total += Math.max(0, Number($('[data-field="quantity"]', line).value) || 0) * Math.max(0, Number($('[data-field="price"]', line).value) || 0);
  }
  $('#quoteTotal').textContent = money.format(total);
}

$('#addLineButton').addEventListener('click', () => addQuoteLine());
$('#newQuoteButton').addEventListener('click', () => resetQuoteBuilder());

function resetQuoteBuilder() {
  quoteBuilder.reset();
  quoteLines.replaceChildren();
  quoteBuilder.elements.requestId.value = '';
  addQuoteLine();
  lastSavedQuote = null;
  $('#quoteActions').hidden = true;
  $('#quoteTitle').textContent = 'Preparar cotización';
  feedback($('#quoteFeedback'), '');
}

function prepareFromRequest(row) {
  resetQuoteBuilder();
  quoteBuilder.elements.requestId.value = row.id;
  quoteBuilder.elements.recipientName.value = row.customer_name || '';
  quoteBuilder.elements.phone.value = row.phone || '';
  quoteBuilder.elements.eventDate.value = row.event_date || '';
  quoteBuilder.elements.city.value = row.city || '';
  quoteBuilder.elements.comments.value = row.notes ? `Solicitud del cliente: ${row.notes}` : '';
  quoteLines.replaceChildren();
  for (const item of row.items || []) addQuoteLine({ id: item.id, quantity: item.quantity, unitPrice: '' });
  if (!row.items?.length) addQuoteLine();
  $('#quoteTitle').textContent = `Responder a ${row.customer_name || 'cliente'}`;
  $('#quoteBuilder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.request-card').forEach((card) => card.classList.toggle('is-active', card.dataset.requestId === row.id));
}

quoteBuilder.addEventListener('input', updateTotal);
quoteBuilder.addEventListener('change', updateTotal);
quoteBuilder.addEventListener('submit', async (event) => {
  event.preventDefault();
  const items = [...quoteLines.querySelectorAll('.quote-line')].map((line) => {
    const item = selectedCatalogItem($('[data-field="product"]', line));
    return item ? {
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: Number($('[data-field="quantity"]', line).value),
      unitPrice: Number($('[data-field="price"]', line).value),
      comment: $('[data-field="comment"]', line).value
    } : null;
  }).filter(Boolean);
  if (items.length !== quoteLines.querySelectorAll('.quote-line').length || !items.length) {
    feedback($('#quoteFeedback'), 'Elige un producto para cada línea.', true);
    return;
  }
  const data = {
    action: 'create-quote',
    requestId: quoteBuilder.elements.requestId.value || null,
    recipientName: quoteBuilder.elements.recipientName.value,
    phone: quoteBuilder.elements.phone.value,
    eventDate: quoteBuilder.elements.eventDate.value,
    city: quoteBuilder.elements.city.value,
    comments: quoteBuilder.elements.comments.value,
    items
  };
  const button = $('#saveQuoteButton');
  button.disabled = true;
  feedback($('#quoteFeedback'), 'Guardando la cotización…');
  try {
    const result = await api('/api/admin', { method: 'POST', body: JSON.stringify(data) });
    const saved = result.quote;
    lastSavedQuote = saved;
    $('#quoteActions').hidden = false;
    $('#sendWhatsAppButton').hidden = !saved.phone;
    renderPrintDocument(saved);
    feedback($('#quoteFeedback'), `Cotización ${saved.quote_number} guardada.`);
    await loadData();
  } catch (error) {
    feedback($('#quoteFeedback'), error.message, true);
  } finally {
    button.disabled = false;
  }
});

function renderPrintDocument(quote) {
  $('#printQuoteNumber').textContent = quote.quote_number;
  $('#printCreatedAt').textContent = `Fecha de emisión: ${formatDate(quote.created_at || new Date().toISOString())}`;
  $('#printRecipient').textContent = quote.recipient_name || '';
  $('#printEventDate').textContent = formatDate(quote.event_date);
  $('#printCity').textContent = quote.city || 'Por confirmar';
  $('#printTotal').textContent = money.format(Number(quote.total) || 0);
  $('#printComments').textContent = quote.comments || '';
  $('#printCommentsSection').hidden = !quote.comments;
  const tbody = $('#printItems');
  tbody.replaceChildren();
  for (const item of quote.items || []) {
    const tr = document.createElement('tr');
    const description = document.createElement('td');
    description.className = 'line-description';
    description.textContent = `${item.name} · ${item.category}`;
    if (item.comment) {
      const small = document.createElement('small');
      small.textContent = item.comment;
      description.append(small);
    }
    const quantity = document.createElement('td'); quantity.textContent = String(item.quantity);
    const unit = document.createElement('td'); unit.textContent = money.format(Number(item.unitPrice) || 0);
    const total = document.createElement('td'); total.textContent = money.format((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
    tr.append(description, quantity, unit, total); tbody.append(tr);
  }
}

function printQuote(quote) {
  renderPrintDocument(quote);
  window.print();
}

$('#downloadPdfButton').addEventListener('click', () => { if (lastSavedQuote) printQuote(lastSavedQuote); });
$('#sendWhatsAppButton').addEventListener('click', () => {
  if (!lastSavedQuote?.phone) return;
  const text = `Hola ${lastSavedQuote.recipient_name}, te compartimos la cotización ${lastSavedQuote.quote_number}. Descarga el PDF desde el panel y adjúntalo a este chat.`;
  const phone = lastSavedQuote.phone.replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
});

addQuoteLine();
checkSession();
