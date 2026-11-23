import { randomUUID } from 'node:crypto';
import { requireAdmin, safeText, sendJson, supabaseRequest, verifySameOrigin, readBody } from '../lib/server.js';

function normalizeQuote(body, admin) {
  const recipientName = safeText(body?.recipientName, 160);
  const items = Array.isArray(body?.items) ? body.items : [];
  const discountPercent = Number(body?.discountPercent ?? 0);
  const ivaPercent = Number(body?.ivaPercent ?? 0);
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
      comment: safeText(item?.comment, 500)
    };
  });
  if (normalizedItems.some((item) => !item.id || !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 1_000_000_000)) return null;
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 || !Number.isFinite(ivaPercent) || ivaPercent < 0 || ivaPercent > 100 || !Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) return null;
  const discountAmount = Math.round(subtotal * discountPercent / 100);
  const ivaAmount = Math.round((subtotal - discountAmount) * ivaPercent / 100);
  const total = subtotal - discountAmount + ivaAmount;
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
    p_iva_percent: ivaPercent,
    p_iva_amount: ivaAmount,
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
      const [requests, quotes] = await Promise.all([
        supabaseRequest('quote_requests', 'GET', undefined, '?select=*&order=created_at.desc&limit=250'),
        supabaseRequest('quotes', 'GET', undefined, '?select=*&order=created_at.desc&limit=250')
      ]);
      res.setHeader('Cache-Control', 'no-store');
      return sendJson(res, 200, { user: admin, requests, quotes });
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

  if (body?.action !== 'create-quote') return sendJson(res, 400, { error: 'Acción no válida.' });
  const quote = normalizeQuote(body, admin);
  if (!quote) return sendJson(res, 400, { error: 'Revisa el destinatario y las líneas de la cotización.' });
  try {
    const rows = await supabaseRequest('rpc/admin_create_quote_v2', 'POST', quote);
    return sendJson(res, 201, { quote: rows });
  } catch {
    return sendJson(res, 503, { error: 'No se pudo guardar la cotización.' });
  }
}
