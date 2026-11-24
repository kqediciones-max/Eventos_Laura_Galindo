const $ = (selector, root = document) => root.querySelector(selector);
const loginScreen = $('#loginScreen');
const adminApp = $('#adminApp');
const loginForm = $('#loginForm');
const quoteBuilder = $('#quoteBuilder');
const quoteLines = $('#quoteLines');
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
let requestRows = [];
let quoteRows = [];
let salesRows = [];
let activeUser = null;
let lastSavedQuote = null;
let pendingSaleQuoteId = null;
let editingQuoteId = null;
let quoteIsDirty = false;
let activeSaleDocument = null;
let activeAttachments = [];

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
    salesRows = data.salesDocuments || [];
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
    salesRows = data.salesDocuments || [];
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
    renderSales(); renderDashboards(); return;
  }
  const search = ($('#quoteSearch')?.value || '').toLowerCase().trim();
  const visibleQuotes = quoteRows.filter((q) => [q.quote_number,q.event_name,q.recipient_name,q.phone,q.event_date].join(' ').toLowerCase().includes(search));
  for (const quote of visibleQuotes) {
    const card = document.createElement('article');
    card.className = 'quote-card';
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = quote.recipient_name;
    const details = document.createElement('p');
    details.textContent = `${quote.quote_number} · ${money.format(Number(quote.total) || 0)} · ${formatDate(quote.created_at)}`;
    copy.append(title, details);
    const actions = document.createElement('div');
    actions.className = 'quote-card-actions';
    const sale = salesRows.find((row) => row.quote_id === quote.id);
    if (sale) {
      const saleButton = document.createElement('button'); saleButton.type = 'button'; saleButton.className = 'admin-button admin-button-primary'; saleButton.textContent = `Ver ${sale.sale_number}`; saleButton.addEventListener('click', () => openSalesDocument(sale)); actions.append(saleButton);
    } else {
      const editButton=document.createElement('button');editButton.type='button';editButton.className='admin-button admin-button-outline';editButton.textContent='Ver';editButton.setAttribute('aria-label',`Ver y editar cotización ${quote.quote_number}`);editButton.addEventListener('click',()=>loadQuoteEditor(quote));actions.append(editButton);
    }
    const copyButton = document.createElement('button'); copyButton.type = 'button'; copyButton.className = 'admin-button admin-button-outline'; copyButton.textContent = 'Copiar'; copyButton.addEventListener('click', () => copyQuote(quote)); actions.append(copyButton);
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'admin-button admin-button-quiet';
    deleteButton.textContent = 'Eliminar';
    deleteButton.setAttribute('aria-label', `Eliminar cotización ${quote.quote_number}`);
    deleteButton.addEventListener('click', () => deleteQuote(quote));
    if (!sale) actions.append(deleteButton);
    card.append(copy, actions);
    list.append(card);
  }
  renderSales();
  renderDashboards();
}

function renderSales() {
  const list = $('#salesList'); list.replaceChildren();
  const search = ($('#saleSearch')?.value || '').toLowerCase().trim();
  const rows = salesRows.filter((s) => [s.sale_number,s.event_name,s.recipient_name,s.phone,s.event_date].join(' ').toLowerCase().includes(search));
  if (!rows.length) { const p = document.createElement('p'); p.className='empty-note'; p.textContent='No hay documentos que coincidan.'; list.append(p); return; }
  for (const sale of rows) {
    const card = document.createElement('article'); card.className='quote-card';
    const info=document.createElement('div'); const title=document.createElement('h3'); title.textContent=`${sale.recipient_name} · ${sale.event_name || 'Evento'}`;
    const meta=document.createElement('p'); meta.textContent=`${sale.sale_number} · ${formatDate(sale.event_date)} · ${money.format(Number(sale.total)||0)} · ${sale.status==='annulled'?'ANULADO':'Vigente'}`; info.append(title,meta);
    const actions=document.createElement('div'); actions.className='quote-card-actions'; const open=document.createElement('button'); open.type='button'; open.className='admin-button admin-button-primary'; open.textContent='Abrir documento'; open.addEventListener('click',()=>openSalesDocument(sale)); actions.append(open); card.append(info,actions); list.append(card);
  }
}

function copyQuote(quote) {
  pendingSaleQuoteId = null; resetQuoteBuilder();
  for (const key of ['recipientName','customerDocument','phone','email','eventName','eventDate','city','validityDays','comments','discountPercent','paymentMethod','deposit']) {
    const map={recipientName:'recipient_name',customerDocument:'customer_document',phone:'phone',email:'email',eventName:'event_name',eventDate:'event_date',city:'city',validityDays:'validity_days',comments:'comments',discountPercent:'discount_percent',paymentMethod:'payment_method',deposit:'deposit'};
    quoteBuilder.elements[key].value = quote[map[key]] ?? '';
  }
  if (quote.tax_type) { quoteBuilder.elements.includeTaxes.checked=true; $('#taxTypeField').hidden=false; quoteBuilder.elements.taxType.disabled=false; quoteBuilder.elements.taxType.value=quote.tax_type; }
  quoteLines.replaceChildren(); (quote.items||[]).forEach((item)=>addQuoteLine(item,{prepend:false,focus:false})); if (!quote.items?.length) addQuoteLine({},{prepend:false,focus:false});
  $('#quoteTitle').textContent=`Copiar ${quote.quote_number}`; $('#quoteBuilder').scrollIntoView({behavior:'smooth',block:'start'}); updateTotal();
}

function loadQuoteEditor(quote) {
  resetQuoteBuilder();
  activeSaleDocument=null;
  editingQuoteId=quote.id;
  quoteIsDirty=false;
  for(const [field,key] of [['recipientName','recipient_name'],['customerDocument','customer_document'],['phone','phone'],['email','email'],['eventName','event_name'],['eventDate','event_date'],['city','city'],['validityDays','validity_days'],['comments','comments'],['discountPercent','discount_percent'],['paymentMethod','payment_method'],['deposit','deposit']]) quoteBuilder.elements[field].value=quote[key]??'';
  if(quote.tax_type){quoteBuilder.elements.includeTaxes.checked=true;$('#taxTypeField').hidden=false;quoteBuilder.elements.taxType.disabled=false;quoteBuilder.elements.taxType.value=quote.tax_type;}
  quoteLines.replaceChildren();(quote.items||[]).forEach(item=>addQuoteLine(item,{prepend:false,focus:false}));if(!quote.items?.length)addQuoteLine({},{prepend:false,focus:false});
  lastSavedQuote=quote;$('#quoteActions').hidden=false;$('#sendWhatsAppButton').hidden=!quote.phone;$('#generateSaleButton').hidden=false;$('#quoteActionNote').textContent='Revisa o edita la información. Guarda los cambios antes de generar el documento de venta.';
  $('#saveQuoteButton').textContent='Guardar cambios';$('#quoteTitle').textContent=`Ver / editar ${quote.quote_number}`;$('#quoteBuilder').scrollIntoView({behavior:'smooth',block:'start'});updateTotal();
}

function renderDashboards() {
  const chosen = (id) => $('#'+id).value || new Date().toISOString().slice(0,10);
  const range = (type,date) => { const d=new Date(`${date}T12:00:00`); let start=new Date(d),end=new Date(d); if(type==='month'){start.setDate(1);end=new Date(d.getFullYear(),d.getMonth()+1,0,12)} else if(type==='week'){const day=(d.getDay()+6)%7;start.setDate(d.getDate()-day);end=new Date(start);end.setDate(start.getDate()+6)} return [start.toISOString().slice(0,10),end.toISOString().slice(0,10)]; };
  const eventType=$('[data-period-for="events"]').value, [es,ee]=range(eventType,chosen('eventsDate'));
  const events=$('#eventsList'); events.replaceChildren(); const dated=salesRows.filter(s=>s.status==='active'&&s.event_date>=es&&s.event_date<=ee);
  if(!dated.length){events.innerHTML='<p class="empty-note">No hay eventos vendidos en este periodo.</p>';} else dated.sort((a,b)=>a.event_date.localeCompare(b.event_date)).forEach(s=>{const card=document.createElement('article');card.className='dashboard-card';const h=document.createElement('h3');h.textContent=s.event_name||'Evento';const p=document.createElement('p');p.textContent=`${formatDate(s.event_date)} · ${s.recipient_name} · ${s.phone||'Sin teléfono'} · ${s.sale_number}`;const b=document.createElement('button');b.type='button';b.className='admin-button admin-button-outline';b.textContent='Abrir documento';b.addEventListener('click',()=>openSalesDocument(s));card.append(h,p,b);events.append(card)});
  const occType=$('[data-period-for="occupancy"]').value,[os,oe]=range(occType,chosen('occupancyDate'));
  const relevant=salesRows.filter(s=>s.status==='active'&&s.reserved_from<=oe&&s.reserved_until>=os);
  const groups=new Map(); for(const s of relevant) for(const item of s.items||[]) if(item.inventoryItem){const key=item.id;const g=groups.get(key)||{name:item.name,quantity:0,docs:[]};g.quantity+=Number(item.quantity)||0;g.docs.push({sale:s,item});groups.set(key,g)}
  const list=$('#occupancyList');list.replaceChildren();if(!groups.size){list.innerHTML='<p class="empty-note">No hay mobiliario ocupado en este periodo.</p>';return;}
  for(const group of groups.values()){const card=document.createElement('article');card.className='dashboard-card';const h=document.createElement('h3');h.textContent=`${group.name} · ${group.quantity} unidades`;const p=document.createElement('p');p.textContent=`Reservado entre ${formatDate(os)} y ${formatDate(oe)}`;card.append(h,p);for(const {sale,item} of group.docs){const b=document.createElement('button');b.type='button';b.className='occupancy-link';b.textContent=`${item.quantity} × ${sale.sale_number} · ${sale.event_name||'Evento'} · ${sale.recipient_name} (${formatDate(sale.reserved_from)}–${formatDate(sale.reserved_until)})`;b.addEventListener('click',()=>openSalesDocument(sale));card.append(b)}list.append(card)}
}

async function openSalesDocument(sale) {
  activeSaleDocument=sale; lastSavedQuote=sale; activeAttachments=[];
  renderPrintDocument(sale,true);
  $('#previewToolbarTitle').textContent=`Documento de venta · ${sale.sale_number}`;
  $('#annulSaleButton').hidden=sale.status==='annulled';
  $('#attachmentManager').hidden=false;
  try { const result=await api(`/api/admin?attachmentsFor=${encodeURIComponent(sale.id)}`); activeAttachments=result.attachments||[]; renderAttachments(); }
  catch { activeAttachments=[]; renderAttachments(); }
  $('#quotePreviewDialog').showModal();
}

function renderAttachments(){
  const list=$('#attachmentList'),print=$('#attachmentPrintGrid');list.replaceChildren();print.replaceChildren();
  $('#printAttachments').hidden=!activeAttachments.length;
  for(const item of activeAttachments){const wrap=document.createElement('figure');wrap.className='attachment-thumb';const img=document.createElement('img');img.src=item.url;img.alt=item.file_name;const caption=document.createElement('figcaption');caption.textContent=item.file_name;const del=document.createElement('button');del.type='button';del.className='admin-button admin-button-quiet';del.textContent='Eliminar imagen';del.addEventListener('click',async()=>{if(!confirm('¿Eliminar este anexo?'))return;try{await api('/api/admin',{method:'POST',body:JSON.stringify({action:'delete-attachment',attachmentId:item.id})});activeAttachments=activeAttachments.filter(a=>a.id!==item.id);renderAttachments()}catch(e){feedback($('#pageFeedback'),e.message,true)}});wrap.append(img,caption,del);list.append(wrap);const pimg=document.createElement('img');pimg.src=item.url;pimg.alt=item.file_name;pimg.className='print-attachment-image';print.append(pimg)}
}

async function uploadAttachmentFiles(files){for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)){feedback($('#pageFeedback'),`${file.name}: formato no permitido.`,true);continue;}try{const blob=await compressAttachment(file);const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob)});const result=await api('/api/admin',{method:'POST',body:JSON.stringify({action:'upload-attachment',saleId:activeSaleDocument.id,fileName:file.name,contentType:blob.type,data})});activeAttachments.push(result.attachment)}catch(e){feedback($('#pageFeedback'),`${file.name}: ${e.message}`,true)}}renderAttachments()}
async function compressAttachment(file){const bitmap=await createImageBitmap(file);let scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');let blob;do{canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.78));scale*=0.85}while(blob&&blob.size>3*1024*1024&&scale>0.35);bitmap.close();if(!blob||blob.size>3*1024*1024)throw new Error('No se pudo reducir a menos de 3 MB.');return blob}

function startSaleFromQuote(quote){
  if(!window.confirm('Al generar el documento de venta quedará asociado a esta cotización y ya no podrás editarla ni eliminarla. El documento solo podrá anularse; para corregirlo tendrás que iniciar una nueva cotización desde cero. ¿Deseas continuar?'))return;
  pendingSaleQuoteId=quote.id;resetQuoteBuilder();pendingSaleQuoteId=quote.id;
  for(const [field,key] of [['recipientName','recipient_name'],['customerDocument','customer_document'],['phone','phone'],['email','email'],['eventName','event_name'],['eventDate','event_date'],['city','city'],['validityDays','validity_days'],['comments','comments'],['discountPercent','discount_percent'],['paymentMethod','payment_method'],['deposit','deposit']]) quoteBuilder.elements[field].value=quote[key]??'';
  if(quote.tax_type){quoteBuilder.elements.includeTaxes.checked=true;$('#taxTypeField').hidden=false;quoteBuilder.elements.taxType.disabled=false;quoteBuilder.elements.taxType.value=quote.tax_type;}
  quoteLines.replaceChildren();(quote.items||[]).forEach(item=>addQuoteLine(item,{prepend:false,focus:false}));
  const eventDate=quote.event_date||new Date().toISOString().slice(0,10);quoteBuilder.elements.reservedFrom.value=eventDate;quoteBuilder.elements.reservedUntil.value=eventDate;
  $('#saleFields').hidden=false;quoteBuilder.elements.reservedFrom.required=true;quoteBuilder.elements.reservedUntil.required=true;
  $('#saveQuoteButton').textContent='Confirmar y generar documento de venta';$('#cancelSaleDraftButton').hidden=false;$('#quoteTitle').textContent=`Generar venta desde ${quote.quote_number}`;$('#quoteBuilder').scrollIntoView({behavior:'smooth',block:'start'});updateTotal();
}

function renderLists() {
  renderRequests();
  renderQuotes();
}

async function deleteQuote(quote) {
  if (!window.confirm(`¿Eliminar la cotización ${quote.quote_number} de ${quote.recipient_name}?`)) return;
  try {
    await api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'delete-quote', quoteId: quote.id }) });
    quoteRows = quoteRows.filter((row) => row.id !== quote.id);
    renderQuotes();
    feedback($('#pageFeedback'), `Se eliminó la cotización ${quote.quote_number}.`);
  } catch (error) {
    feedback($('#pageFeedback'), error.message, true);
  }
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
  const options = [...products, ...eventOptions].map((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} · ${item.category}`;
    if (item.id === selectedId) option.selected = true;
    return option;
  });
  const customOption = document.createElement('option');
  customOption.value = 'outside-inventory';
  customOption.textContent = 'Producto fuera del inventario';
  options.unshift(customOption);
  return options;
}

function addQuoteLine(item = {}, { prepend = true, focus = true } = {}) {
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

  const customNameLabel = document.createElement('label');
  customNameLabel.className = 'custom-item-name';
  customNameLabel.textContent = 'Nombre del producto fuera del inventario';
  customNameLabel.hidden = true;
  const customName = document.createElement('input');
  customName.type = 'text';
  customName.maxLength = 180;
  customName.placeholder = 'Escribe el nombre para esta cotización';
  customName.dataset.field = 'customName';
  customName.disabled = true;
  customNameLabel.append(customName);
  select.addEventListener('change', () => {
    const isCustom = select.value === 'outside-inventory';
    row.classList.toggle('has-custom-item', isCustom);
    customNameLabel.hidden = !isCustom;
    customName.disabled = !isCustom;
    customName.required = isCustom;
    if (isCustom) customName.focus();
    else customName.value = '';
    updateTotal();
  });
  if (item.id === 'outside-inventory') { select.value='outside-inventory'; row.classList.add('has-custom-item'); customNameLabel.hidden=false; customName.disabled=false; customName.required=true; customName.value=item.name||''; }

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
  remove.addEventListener('click', () => { row.remove(); if(editingQuoteId)quoteIsDirty=true; updateTotal(); });
  row.append(itemLabel, customNameLabel, quantityLabel, priceLabel, noteLabel, remove);
  for (const control of row.querySelectorAll('input,select')) control.addEventListener('input', updateTotal);
  if (prepend) quoteLines.prepend(row);
  else quoteLines.append(row);
  updateTotal();
  if (focus) {
    select.focus({ preventScroll: true });
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return row;
}

function selectedCatalogItem(select) {
  return [...products, ...eventOptions].find((item) => item.id === select.value);
}

function updateTotal() {
  let subtotal = 0;
  for (const line of quoteLines.querySelectorAll('.quote-line')) {
    subtotal += Math.max(0, Number($('[data-field="quantity"]', line).value) || 0) * Math.max(0, Number($('[data-field="price"]', line).value) || 0);
  }
  const discount = Math.round(subtotal * (Number(quoteBuilder.elements.discountPercent.value) || 0) / 100);
  const taxable = Math.max(0, subtotal - discount);
  const taxRates = { iva_5: 5, iva_19: 19, consumo_8: 8 };
  const taxPercent = quoteBuilder.elements.includeTaxes.checked ? (taxRates[quoteBuilder.elements.taxType.value] || 0) : 0;
  const taxAmount = Math.round(taxable * taxPercent / 100);
  $('#quoteTotal').textContent = money.format(taxable + taxAmount);
}

quoteBuilder.elements.includeTaxes.addEventListener('change', () => {
  const enabled = quoteBuilder.elements.includeTaxes.checked;
  $('#taxTypeField').hidden = !enabled;
  quoteBuilder.elements.taxType.disabled = !enabled;
  if (!enabled) quoteBuilder.elements.taxType.value = '';
  updateTotal();
});
quoteBuilder.elements.taxType.addEventListener('change', updateTotal);

$('#addLineButton').addEventListener('click', () => { addQuoteLine(); if(editingQuoteId)quoteIsDirty=true; });
$('#newQuoteButton').addEventListener('click', () => resetQuoteBuilder());

function resetQuoteBuilder() {
  quoteBuilder.reset();
  $('#taxTypeField').hidden = true;
  quoteBuilder.elements.taxType.disabled = true;
  quoteLines.replaceChildren();
  quoteBuilder.elements.requestId.value = '';
  editingQuoteId=null;
  quoteIsDirty=false;
  activeSaleDocument=null;
  addQuoteLine();
  lastSavedQuote = null;
  $('#quoteActions').hidden = true;
  $('#quoteTitle').textContent = 'Preparar cotización';
  $('#quoteActionNote').textContent='Abre la vista formal y descarga el PDF desde allí.';
  $('#saleFields').hidden=true;quoteBuilder.elements.reservedFrom.required=false;quoteBuilder.elements.reservedUntil.required=false;
  $('#saveQuoteButton').textContent='Guardar cotización';$('#cancelSaleDraftButton').hidden=true;pendingSaleQuoteId=null;
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
  for (const item of row.items || []) addQuoteLine({ id: item.id, quantity: item.quantity, unitPrice: '' }, { prepend: false, focus: false });
  if (!row.items?.length) addQuoteLine();
  $('#quoteTitle').textContent = `Responder a ${row.customer_name || 'cliente'}`;
  $('#quoteBuilder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.request-card').forEach((card) => card.classList.toggle('is-active', card.dataset.requestId === row.id));
}

quoteBuilder.addEventListener('input', updateTotal);
quoteBuilder.addEventListener('change', updateTotal);
quoteBuilder.addEventListener('input',()=>{if(editingQuoteId)quoteIsDirty=true});
quoteBuilder.addEventListener('change',()=>{if(editingQuoteId)quoteIsDirty=true});
quoteBuilder.addEventListener('submit', async (event) => {
  event.preventDefault();
  const items = [...quoteLines.querySelectorAll('.quote-line')].map((line) => {
    const select = $('[data-field="product"]', line);
    if (select.value === 'outside-inventory') {
      const name = $('[data-field="customName"]', line).value.trim();
      return name ? {
        id: 'outside-inventory',
        name,
        category: 'Producto fuera del inventario',
        quantity: Number($('[data-field="quantity"]', line).value),
        unitPrice: Number($('[data-field="price"]', line).value),
        comment: $('[data-field="comment"]', line).value,
        inventoryItem: false
      } : null;
    }
    const item = selectedCatalogItem(select);
    return item ? {
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: Number($('[data-field="quantity"]', line).value),
      unitPrice: Number($('[data-field="price"]', line).value),
      comment: $('[data-field="comment"]', line).value,
      inventoryItem: products.some((product) => product.id === item.id)
    } : null;
  }).filter(Boolean);
  if (items.length !== quoteLines.querySelectorAll('.quote-line').length || !items.length) {
    feedback($('#quoteFeedback'), 'Elige un producto para cada línea.', true);
    return;
  }
  if (quoteBuilder.elements.includeTaxes.checked && !quoteBuilder.elements.taxType.value) {
    feedback($('#quoteFeedback'), 'Selecciona IVA 5%, IVA 19% o impuesto al consumo 8%.', true);
    return;
  }
  const data = {
    action: pendingSaleQuoteId ? 'create-sale' : editingQuoteId ? 'update-quote' : 'create-quote',
    quoteId: pendingSaleQuoteId || editingQuoteId,
    quoteId: pendingSaleQuoteId,
    reservedFrom: quoteBuilder.elements.reservedFrom.value,
    reservedUntil: quoteBuilder.elements.reservedUntil.value,
    requestId: quoteBuilder.elements.requestId.value || null,
    recipientName: quoteBuilder.elements.recipientName.value,
    phone: quoteBuilder.elements.phone.value,
    customerDocument: quoteBuilder.elements.customerDocument.value,
    email: quoteBuilder.elements.email.value,
    eventName: quoteBuilder.elements.eventName.value,
    eventDate: quoteBuilder.elements.eventDate.value,
    city: quoteBuilder.elements.city.value,
    validityDays: Number(quoteBuilder.elements.validityDays.value),
    comments: quoteBuilder.elements.comments.value,
    discountPercent: Number(quoteBuilder.elements.discountPercent.value),
    taxType: quoteBuilder.elements.includeTaxes.checked ? quoteBuilder.elements.taxType.value : '',
    paymentMethod: quoteBuilder.elements.paymentMethod.value,
    deposit: quoteBuilder.elements.deposit.value,
    items
  };
  const button = $('#saveQuoteButton');
  button.disabled = true;
  feedback($('#quoteFeedback'), pendingSaleQuoteId ? 'Generando el documento de venta…' : editingQuoteId ? 'Guardando cambios…' : 'Guardando la cotización…');
  try {
    const result = await api('/api/admin', { method: 'POST', body: JSON.stringify(data) });
    const saved = result.quote || result.salesDocument;
    lastSavedQuote = saved;
    if(result.quote){editingQuoteId=saved.id;quoteIsDirty=false;$('#saveQuoteButton').textContent='Guardar cambios';}
    $('#quoteActions').hidden = false;
    $('#sendWhatsAppButton').hidden = !saved.phone;
    $('#generateSaleButton').hidden=Boolean(result.salesDocument)||salesRows.some(s=>s.quote_id===saved.id);
    $('#quoteActionNote').textContent=result.salesDocument?'Documento de venta generado y asociado a la cotización.':'Revisa o edita los datos. Guarda los cambios antes de generar la venta.';
    renderPrintDocument(saved);
    if (result.salesDocument) { pendingSaleQuoteId=null; $('#saleFields').hidden=true; quoteBuilder.elements.reservedFrom.required=false; quoteBuilder.elements.reservedUntil.required=false; $('#saveQuoteButton').textContent='Guardar cotización'; $('#cancelSaleDraftButton').hidden=true; feedback($('#quoteFeedback'), `Documento de venta ${saved.sale_number} generado.`); }
    else feedback($('#quoteFeedback'), `Cotización ${saved.quote_number} guardada.`);
    await loadData();
    if (result.salesDocument) await openSalesDocument(saved);
  } catch (error) {
    feedback($('#quoteFeedback'), error.message, true);
  } finally {
    button.disabled = false;
  }
});

function renderPrintDocument(quote, isSale = false) {
  const number = isSale ? quote.sale_number : quote.quote_number;
  $('#printQuoteNumber').textContent = number || '';
  document.querySelector('.print-info-grid .print-info-box:nth-child(2) dt').textContent = isSale ? 'N.º documento:' : 'N.º cotización:';
  $('.print-title h2').textContent = isSale ? 'DOCUMENTO DE VENTA' : 'COTIZACIÓN';
  $('#printAnnulled').hidden = !isSale || quote.status !== 'annulled';
  $('#printAnnulmentReason').textContent = quote.annulment_reason || '';
  $('#previewToolbarTitle').textContent = isSale ? `Documento de venta · ${number}` : 'Vista previa · Cotización formal';
  $('#printCreatedAt').textContent = `Fecha de emisión: ${formatDate(quote.created_at || new Date().toISOString())}`;
  $('#printRecipient').textContent = quote.recipient_name || '';
  $('#printCustomerDocument').textContent = quote.customer_document || '—';
  $('#printPhone').textContent = quote.phone || '—';
  $('#printEmail').textContent = quote.email || '—';
  $('#printEventName').textContent = quote.event_name || '—';
  $('#printEventDate').textContent = formatDate(quote.event_date);
  $('#printAvailabilityNote').textContent=isSale?'Documento interno de control de venta. La reserva del mobiliario corresponde al periodo indicado y queda sujeta a la confirmación del anticipo o abono acordado.':'Durante la vigencia indicada se respetan los valores cotizados. La disponibilidad de los productos no queda reservada por esta cotización y se confirma al formalizar la reserva con el anticipo o abono acordado.';
  $('#printReservedFromLabel').hidden=!isSale;$('#printReservedFrom').hidden=!isSale;$('#printReservedUntilLabel').hidden=!isSale;$('#printReservedUntil').hidden=!isSale;
  $('#printReservedFrom').textContent=formatDate(quote.reserved_from);$('#printReservedUntil').textContent=formatDate(quote.reserved_until);
  $('#printCity').textContent = quote.city || 'Por confirmar';
  const validityDays = Number(quote.validity_days) || 30;
  $('#printValidity').textContent = isSale ? 'No aplica' : `${validityDays} días`;
  const issued = new Date(`${(quote.created_at || new Date().toISOString()).slice(0, 10)}T12:00:00`);
  issued.setDate(issued.getDate() + validityDays);
  $('#printValidUntil').textContent = isSale ? 'No aplica' : formatDate(issued.toISOString().slice(0, 10));
  const computedSubtotal = (quote.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const subtotal = Number(quote.subtotal) || computedSubtotal;
  $('#printSubtotal').textContent = money.format(subtotal);
  $('#printDiscountPercent').textContent = String(Number(quote.discount_percent) || 0);
  $('#printDiscount').textContent = money.format(Number(quote.discount_amount) || 0);
  const legacyIvaPercent = Number(quote.iva_percent) || 0;
  const taxType = quote.tax_type || (legacyIvaPercent ? 'iva_legacy' : '');
  const taxNames = { iva_5: 'IVA 5%', iva_19: 'IVA 19%', consumo_8: 'Impuesto al consumo 8%' };
  $('#printTaxRow').hidden = !taxType;
  $('#printTaxAmount').hidden = !taxType;
  $('#printTaxLabel').textContent = taxNames[taxType] || (taxType === 'iva_legacy' ? `IVA ${legacyIvaPercent}%` : '');
  $('#printTaxAmount').textContent = money.format(Number(quote.tax_amount ?? quote.iva_amount) || 0);
  $('#printTotal').textContent = money.format(Number(quote.total) || 0);
  $('#printPaymentMethod').textContent = quote.payment_method || 'Por acordar';
  $('#printDeposit').textContent = quote.deposit || 'Por acordar';
  $('#printSignatureName').textContent = quote.recipient_name || 'Nombre, firma y fecha';
  $('#printComments').textContent = quote.comments || '';
  $('#printCommentsSection').hidden = !quote.comments;
  const tbody = $('#printItems');
  tbody.replaceChildren();
  for (const [index, item] of (quote.items || []).entries()) {
    const tr = document.createElement('tr');
    const number = document.createElement('td'); number.textContent = String(index + 1);
    const description = document.createElement('td');
    description.className = 'line-description';
    description.textContent = `${item.name}${item.category ? ` · ${item.category}` : ''}`;
    if (item.comment) {
      const small = document.createElement('small');
      small.textContent = item.comment;
      description.append(small);
    }
    const quantity = document.createElement('td'); quantity.textContent = String(item.quantity);
    const unit = document.createElement('td'); unit.textContent = 'Unid.';
    const unitPrice = document.createElement('td'); unitPrice.textContent = money.format(Number(item.unitPrice) || 0);
    const total = document.createElement('td'); total.textContent = money.format((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
    tr.append(number, description, quantity, unit, unitPrice, total); tbody.append(tr);
  }
}

function printQuote(quote) {
  lastSavedQuote = quote;
  activeSaleDocument=null;
  $('#attachmentManager').hidden=true;$('#annulSaleButton').hidden=true;$('#previewToolbarTitle').textContent='Vista previa · Cotización formal';
  $('#printAttachments').hidden=true;
  renderPrintDocument(quote);
  $('#quotePreviewDialog').showModal();
}

$('#viewQuoteButton').addEventListener('click', () => { if (lastSavedQuote) printQuote(lastSavedQuote); });
$('#generateSaleButton').addEventListener('click',()=>{
  if(!editingQuoteId||!lastSavedQuote)return;
  if(quoteIsDirty){feedback($('#quoteFeedback'),'Guarda primero los cambios para que el documento de venta se genere con la información actual.',true);$('#quoteBuilder').scrollIntoView({behavior:'smooth',block:'start'});return;}
  const quote=quoteRows.find(row=>row.id===editingQuoteId)||lastSavedQuote;
  startSaleFromQuote(quote);
});
$('#closeQuotePreview').addEventListener('click', () => $('#quotePreviewDialog').close());
$('#quotePreviewDialog').addEventListener('click', (event) => { if (event.target === $('#quotePreviewDialog')) $('#quotePreviewDialog').close(); });
$('#downloadPdfButton').addEventListener('click', () => { if (lastSavedQuote) window.print(); });
$('#shareDocumentButton').addEventListener('click',()=>sendDocumentToWhatsApp(lastSavedQuote));
$('#cancelSaleDraftButton').addEventListener('click', resetQuoteBuilder);
$('#quoteSearch').addEventListener('input',renderQuotes);$('#saleSearch').addEventListener('input',renderSales);
document.querySelectorAll('[data-period-for],#eventsDate,#occupancyDate').forEach(el=>el.addEventListener('change',renderDashboards));
document.querySelectorAll('[data-admin-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-admin-tab]').forEach(x=>x.classList.toggle('is-active',x===button));$('#managementDashboard').hidden=button.dataset.adminTab!=='management';$('#eventsDashboard').hidden=button.dataset.adminTab!=='events';$('#occupancyDashboard').hidden=button.dataset.adminTab!=='occupancy';if(button.dataset.adminTab==='events'||button.dataset.adminTab==='occupancy')renderDashboards()}));
$('#attachmentInput').addEventListener('change',async(event)=>{if(activeSaleDocument&&event.target.files?.length)await uploadAttachmentFiles([...event.target.files]);event.target.value=''});
$('#annulSaleButton').addEventListener('click',async()=>{if(!activeSaleDocument||activeSaleDocument.status==='annulled')return;const reason=window.prompt('Indica el motivo de anulación del documento:');if(!reason||reason.trim().length<3)return;try{await api('/api/admin',{method:'POST',body:JSON.stringify({action:'annul-sale',saleId:activeSaleDocument.id,reason:reason.trim()})});await loadData();const updated=salesRows.find(s=>s.id===activeSaleDocument.id);if(updated)await openSalesDocument(updated)}catch(e){feedback($('#pageFeedback'),e.message,true)}});
$('#sendWhatsAppButton').addEventListener('click', () => sendDocumentToWhatsApp(lastSavedQuote));

async function sendDocumentToWhatsApp(documentData) {
  if (!documentData) return;
  if (!documentData.sale_number && quoteIsDirty) {
    feedback($('#quoteFeedback'),'Guarda primero los cambios para compartir el PDF actualizado.',true);
    return;
  }
  if (!activeSaleDocument && !$('#quotePreviewDialog').open) {
    if (documentData.sale_number) await openSalesDocument(documentData);
    else printQuote(documentData);
  }
  if (!documentData.phone) { feedback($('#pageFeedback'),'Agrega el teléfono del cliente antes de abrir WhatsApp.',true); return; }
  const isSale=Boolean(documentData.sale_number);
  const number=isSale?documentData.sale_number:documentData.quote_number;
  const kind=isSale?'documento de venta':'cotización';
  const fileName=`${(number||'Laura-Galindo').replace(/[^a-z0-9_-]/gi,'_')}.pdf`;
  const phone=whatsAppPhone(documentData.phone);
  const message=`Hola ${documentData.recipient_name}, te compartimos el PDF de tu ${kind} ${number}.`;
  const directUrl=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  let nativeShare=false;
  try { nativeShare=Boolean(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([''],fileName,{type:'application/pdf'})]})); } catch {}
  const fallbackWindow=nativeShare?null:window.open('about:blank','_blank');
  const controls=[$('#sendWhatsAppButton'),$('#shareDocumentButton')];controls.forEach(button=>button.disabled=true);
  feedback($('#pageFeedback'),'Preparando el PDF…');
  try {
    const pdf=await buildDocumentPdf(fileName);
    const file=new File([pdf],fileName,{type:'application/pdf'});
    if(nativeShare&&navigator.canShare({files:[file]})) {
      if(fallbackWindow&&!fallbackWindow.closed)fallbackWindow.close();
      await navigator.share({files:[file],title:`${kind} ${number}`,text:`${message} Destinatario: ${documentData.phone}`});
      feedback($('#pageFeedback'),'Selecciona WhatsApp en el menú para compartir el PDF.');
      return;
    }
    downloadBlob(pdf,fileName);
    if(fallbackWindow&&!fallbackWindow.closed)fallbackWindow.location.href=directUrl;
    else window.location.assign(directUrl);
    feedback($('#pageFeedback'),'PDF descargado y chat de WhatsApp abierto. Adjunta el archivo descargado al mensaje.');
  } catch(error) {
    if(fallbackWindow&&!fallbackWindow.closed)fallbackWindow.close();
    if(error?.name==='AbortError')return;
    feedback($('#pageFeedback'),`No se pudo preparar el PDF. Puedes usar “Imprimir / Guardar PDF” y adjuntarlo en WhatsApp. ${error.message||''}`,true);
  } finally { controls.forEach(button=>button.disabled=false); }
}

async function buildDocumentPdf(fileName) {
  if(typeof window.html2pdf!=='function')throw new Error('No cargó el generador de PDF.');
  const images=[...$('#printDocument').querySelectorAll('img')];
  await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,8000)})));
  const options={margin:[8,8,10,8],filename:fileName,image:{type:'jpeg',quality:0.96},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',imageTimeout:12000,onclone:(clonedDocument)=>{const article=clonedDocument.querySelector('#printDocument');if(article){article.style.minHeight='0';article.style.margin='0 auto';article.style.boxShadow='none'}}},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy'],avoid:['.print-info-box','.print-totals','.print-attachments figure']}};
  return window.html2pdf().set(options).from($('#printDocument')).outputPdf('blob');
}

function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function whatsAppPhone(value){const digits=String(value||'').replace(/\D/g,'');return digits.length===10?`57${digits}`:digits}

addQuoteLine();
const today = new Date().toISOString().slice(0,10); $('#eventsDate').value=today; $('#occupancyDate').value=today;
checkSession();
