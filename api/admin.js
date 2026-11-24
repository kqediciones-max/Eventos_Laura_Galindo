import { randomUUID } from 'node:crypto';
import { requireAdmin, safeText, sendJson, supabaseRequest, verifySameOrigin, readBody } from '../lib/server.js';

function normalizeQuote(body, admin) {
  const recipientName = safeText(body?.recipientName, 160);
  const items = Array.isArray(body?.items) ? body.items : [];
  const discountPercent = Number(body?.discountPercent ?? 0);
  const taxType = safeText(body?.taxType, 20);
  const taxOptions = {
    iva_5: { label: 'IVA 5%', percent: 5 },
    iva_19: { label: 'IVA 19%', percent: 19 },
    consumo_8: { label: 'Impuesto al consumo 8%', percent: 8 }
  };
  const tax = taxType ? taxOptions[taxType] : null;
  const validityDays = Number(body?.validityDays ?? 30);
  if (!recipientName || items.length < 1 || items.length > 80) return null;

  const normalizedItems = items.map((item) => {
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);
    return {
      id: safeText(item?.id, 80),
      name: safeText(item?.name, 180),
      category: safeText(item?.category, 100),
      quantity,
      unitPrice,
      comment: safeText(item?.comment, 500),
      inventoryItem: Boolean(item?.inventoryItem) && !String(item?.id || '').startsWith('event-') && item?.id !== 'outside-inventory'
    };
  });
  if (normalizedItems.some((item) => !item.id || !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 1_000_000_000)) return null;
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 || (taxType && !tax) || !Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) return null;
  const discountAmount = Math.round(subtotal * discountPercent / 100);
  const taxPercent = tax?.percent || 0;
  const taxAmount = Math.round((subtotal - discountAmount) * taxPercent / 100);
  const isIva = taxType.startsWith('iva_');
  const total = subtotal - discountAmount + taxAmount;
  if (!Number.isFinite(total) || total > 10_000_000_000) return null;

  const now = new Date();
  const quoteNumber = `LG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    p_request_id: body?.requestId || null,
    p_quote_number: quoteNumber,
    p_recipient_name: recipientName,
    p_phone: safeText(body?.phone, 40),
    p_customer_document: safeText(body?.customerDocument, 80),
    p_email: safeText(body?.email, 180),
    p_event_name: safeText(body?.eventName, 160),
    p_event_date: safeText(body?.eventDate, 20) || null,
    p_city: safeText(body?.city, 120),
    p_validity_days: validityDays,
    p_comments: safeText(body?.comments, 3000),
    p_items: normalizedItems,
    p_subtotal: Math.round(subtotal),
    p_discount_percent: discountPercent,
    p_discount_amount: discountAmount,
    p_iva_percent: isIva ? taxPercent : 0,
    p_iva_amount: isIva ? taxAmount : 0,
    p_tax_type: taxType,
    p_tax_percent: taxPercent,
    p_tax_amount: taxAmount,
    p_total: Math.round(total),
    p_payment_method: safeText(body?.paymentMethod, 240),
    p_deposit: safeText(body?.deposit, 240),
    p_created_by: admin.name
  };
}

export default async function handler(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    try {
      const [requests, quotes, salesDocuments] = await Promise.all([
        supabaseRequest('quote_requests', 'GET', undefined, '?select=*&order=created_at.desc&limit=250'),
        supabaseRequest('quotes', 'GET', undefined, '?select=*&order=created_at.desc&limit=1000'),
        supabaseRequest('sales_documents', 'GET', undefined, '?select=*&order=created_at.desc&limit=1000')
      ]);
      const attachmentsFor = safeText(req.query?.attachmentsFor, 40);
      let attachments = [];
      if (attachmentsFor && /^[0-9a-f-]{36}$/i.test(attachmentsFor)) {
        const rows = await supabaseRequest('sales_document_attachments', 'GET', undefined, `?select=*&sales_document_id=eq.${attachmentsFor}&order=created_at.asc`);
        attachments = await Promise.all(rows.map(async (row) => ({ ...row, url: await signedObjectUrl(row.object_path) })));
      }
      res.setHeader('Cache-Control', 'no-store');
      return sendJson(res, 200, { user: admin, requests, quotes, salesDocuments, attachments });
    } catch {
      return sendJson(res, 503, { error: 'No se pudo consultar la base de datos.' });
    }
  }

  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido.' });
  if (!verifySameOrigin(req)) return sendJson(res, 403, { error: 'Origen no autorizado.' });
  const body = readBody(req);

  if (body?.action === 'status') {
    const requestId = safeText(body.requestId, 40);
    const status = body.status;
    if (!requestId || !['pending', 'quoted', 'closed'].includes(status)) return sendJson(res, 400, { error: 'Estado de solicitud no válido.' });
    try {
      await supabaseRequest(`quote_requests?id=eq.${encodeURIComponent(requestId)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 503, { error: 'No se pudo actualizar la solicitud.' });
    }
  }

  if (body?.action === 'delete-quote') {
    const quoteId = safeText(body.quoteId, 40);
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return sendJson(res, 400, { error: 'Identificador de cotización no válido.' });
    try {
      const linked = await supabaseRequest('sales_documents', 'GET', undefined, `?select=id&quote_id=eq.${quoteId}&limit=1`);
      if (linked?.length) return sendJson(res, 409, { error: 'Esta cotización tiene un documento de venta asociado y no se puede eliminar.' });
      const existing = await supabaseRequest('quotes', 'GET', undefined, `?select=request_id&id=eq.${quoteId}&limit=1`);
      if (!existing?.length) return sendJson(res, 404, { error: 'No se encontró la cotización.' });
      await supabaseRequest(`quotes?id=eq.${quoteId}`, 'DELETE');
      const requestId = existing[0].request_id;
      if (requestId) {
        const remaining = await supabaseRequest('quotes', 'GET', undefined, `?select=id&request_id=eq.${requestId}&limit=1`);
        if (!remaining?.length) await supabaseRequest(`quote_requests?id=eq.${requestId}`, 'PATCH', { status: 'pending', updated_at: new Date().toISOString() });
      }
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 503, { error: 'No se pudo eliminar la cotización.' });
    }
  }

  if (body?.action === 'create-sale') {
    const quoteId = safeText(body.quoteId, 40);
    const reservedFrom = safeText(body.reservedFrom, 10);
    const reservedUntil = safeText(body.reservedUntil, 10);
    if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !/^\d{4}-\d{2}-\d{2}$/.test(reservedFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(reservedUntil) || reservedUntil < reservedFrom) {
      return sendJson(res, 400, { error: 'Indica un intervalo válido de salida y devolución del mobiliario.' });
    }
    try {
      const quoteRows = await supabaseRequest('quotes', 'GET', undefined, `?select=id&id=eq.${quoteId}&limit=1`);
      if (!quoteRows?.length) return sendJson(res, 404, { error: 'No se encontró la cotización de origen.' });
      const normalized = normalizeQuote({ ...body, requestId: null }, admin);
      if (!normalized) return sendJson(res, 400, { error: 'Revisa el cliente, evento y productos del documento.' });
      if (!normalized.p_event_name || !normalized.p_event_date) return sendJson(res, 400, { error: 'Para generar la venta, indica el tipo de evento y su fecha.' });
      const existing = await supabaseRequest('sales_documents', 'GET', undefined, `?select=id&quote_id=eq.${quoteId}&limit=1`);
      if (existing?.length) return sendJson(res, 409, { error: 'Esta cotización ya tiene un documento de venta.' });
      const saleNumber = `VTA-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const sale = {
        quote_id: quoteId, sale_number: saleNumber, recipient_name: normalized.p_recipient_name,
        phone: normalized.p_phone, customer_document: normalized.p_customer_document, email: normalized.p_email,
        event_name: normalized.p_event_name, event_date: normalized.p_event_date, city: normalized.p_city,
        reserved_from: reservedFrom, reserved_until: reservedUntil, comments: normalized.p_comments,
        items: normalized.p_items, subtotal: normalized.p_subtotal, discount_percent: normalized.p_discount_percent,
        discount_amount: normalized.p_discount_amount, iva_percent: normalized.p_iva_percent, iva_amount: normalized.p_iva_amount,
        tax_type: normalized.p_tax_type, tax_percent: normalized.p_tax_percent, tax_amount: normalized.p_tax_amount,
        total: normalized.p_total, payment_method: normalized.p_payment_method, deposit: normalized.p_deposit,
        created_by: admin.name
      };
      const rows = await supabaseRequest('sales_documents', 'POST', sale);
      return sendJson(res, 201, { salesDocument: rows?.[0] || sale });
    } catch (error) {
      if (String(error.message).includes('duplicate key')) return sendJson(res, 409, { error: 'Esta cotización ya tiene un documento de venta.' });
      return sendJson(res, 503, { error: 'No se pudo generar el documento de venta.' });
    }
  }

  if (body?.action === 'annul-sale') {
    const saleId = safeText(body.saleId, 40);
    const reason = safeText(body.reason, 1000);
    if (!/^[0-9a-f-]{36}$/i.test(saleId) || reason.length < 3) return sendJson(res, 400, { error: 'Escribe el motivo de anulación.' });
    try {
      const rows = await supabaseRequest(`sales_documents?id=eq.${saleId}&status=eq.active`, 'PATCH', {
        status: 'annulled', annulled_at: new Date().toISOString(), annulled_by: admin.name, annulment_reason: reason
      });
      return sendJson(res, 200, { ok: true, rows });
    } catch {
      return sendJson(res, 409, { error: 'No se pudo anular. El documento puede estar ya anulado.' });
    }
  }

  if (body?.action === 'upload-attachment') {
    const saleId = safeText(body.saleId, 40);
    const fileName = safeText(body.fileName, 180);
    const contentType = safeText(body.contentType, 40);
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!/^[0-9a-f-]{36}$/i.test(saleId) || !fileName || !allowed.includes(contentType) || typeof body.data !== 'string') return sendJson(res, 400, { error: 'Archivo no válido.' });
    try {
      const sale = await supabaseRequest('sales_documents', 'GET', undefined, `?select=id&id=eq.${saleId}&limit=1`);
      if (!sale?.length) return sendJson(res, 404, { error: 'No se encontró el documento.' });
      const buffer = Buffer.from(body.data, 'base64');
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) return sendJson(res, 413, { error: 'Cada imagen debe pesar menos de 5 MB.' });
      const path = `${saleId}/${randomUUID()}.${contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'}`;
      await storageRequest(`/object/sales-doc-attachments/${path}`, 'POST', buffer, { 'Content-Type': contentType, 'x-upsert': 'false' });
      const rows = await supabaseRequest('sales_document_attachments', 'POST', { sales_document_id: saleId, object_path: path, file_name: fileName, content_type: contentType, created_by: admin.name });
      return sendJson(res, 201, { attachment: { ...rows?.[0], url: await signedObjectUrl(path) } });
    } catch {
      return sendJson(res, 503, { error: 'No se pudo guardar el anexo.' });
    }
  }

  if (body?.action === 'delete-attachment') {
    const attachmentId = safeText(body.attachmentId, 40);
    if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) return sendJson(res, 400, { error: 'Anexo no válido.' });
    try {
      const rows = await supabaseRequest('sales_document_attachments', 'GET', undefined, `?select=id,object_path&id=eq.${attachmentId}&limit=1`);
      if (!rows?.length) return sendJson(res, 404, { error: 'No se encontró el anexo.' });
      await storageRequest(`/object/sales-doc-attachments/${rows[0].object_path}`, 'DELETE');
      await supabaseRequest(`sales_document_attachments?id=eq.${attachmentId}`, 'DELETE');
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 503, { error: 'No se pudo eliminar el anexo.' });
    }
  }

  if (body?.action !== 'create-quote') return sendJson(res, 400, { error: 'Acción no válida.' });
  const quote = normalizeQuote(body, admin);
  if (!quote) return sendJson(res, 400, { error: 'Revisa el destinatario y las líneas de la cotización.' });
  try {
    const rows = await supabaseRequest('rpc/admin_create_quote_v3', 'POST', quote);
    return sendJson(res, 201, { quote: rows });
  } catch {
    return sendJson(res, 503, { error: 'No se pudo guardar la cotización.' });
  }
}

async function storageRequest(path, method, body, extraHeaders = {}) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) throw new Error('Supabase no está configurado.');
  const response = await fetch(`${base}/storage/v1${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, ...extraHeaders }, body });
  if (!response.ok) throw new Error(`Storage respondió ${response.status}`);
  return response.json().catch(() => ({}));
}

async function signedObjectUrl(path) {
  const result = await storageRequest('/object/sign/sales-doc-attachments/' + path.split('/').map(encodeURIComponent).join('/'), 'POST', JSON.stringify({ expiresIn: 3600 }), { 'Content-Type': 'application/json' });
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  return `${base}/storage/v1${result.signedURL}`;
}
