import { publicRateLimited, readBody, safeText, sendJson, supabaseRequest, verifySameOrigin } from '../lib/server.js';

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 80) return null;
  const normalized = items.map((item) => ({
    id: safeText(item?.id, 80),
    name: safeText(item?.name, 180),
    category: safeText(item?.category, 100),
    quantity: Number(item?.quantity)
  }));
  if (normalized.some((item) => !item.id || !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999)) return null;
  return normalized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido.' });
  if (!verifySameOrigin(req)) return sendJson(res, 403, { error: 'Origen no autorizado.' });
  if (publicRateLimited(req)) return sendJson(res, 429, { error: 'Intenta nuevamente en un minuto.' });
  if (Number(req.headers['content-length'] || 0) > 30_000) return sendJson(res, 413, { error: 'La solicitud es demasiado extensa.' });

  const body = readBody(req);
  const customerName = safeText(body?.customerName, 120);
  const items = normalizeItems(body?.items);
  if (!customerName || !items) return sendJson(res, 400, { error: 'Revisa el nombre y los productos seleccionados.' });

  try {
    const rows = await supabaseRequest('quote_requests', 'POST', {
      customer_name: customerName,
      phone: safeText(body?.phone, 40),
      event_date: safeText(body?.eventDate, 20) || null,
      city: safeText(body?.city, 120),
      notes: safeText(body?.notes, 2500),
      items,
      status: 'pending'
    });
    return sendJson(res, 201, { id: rows?.[0]?.id });
  } catch {
    return sendJson(res, 503, { error: 'No pudimos guardar la solicitud. WhatsApp sigue disponible.' });
  }
}
