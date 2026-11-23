import { clearSessionCookie, sendJson, verifySameOrigin } from '../lib/server.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido.' });
  if (!verifySameOrigin(req)) return sendJson(res, 403, { error: 'Origen no autorizado.' });
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  return sendJson(res, 200, { ok: true });
}
