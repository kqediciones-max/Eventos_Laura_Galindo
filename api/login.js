import {
  adminAccount, loginRateLimited, safePasswordEqual, sendJson,
  sessionCookie, verifySameOrigin, readBody
} from '../lib/server.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método no permitido.' });
  if (!verifySameOrigin(req)) return sendJson(res, 403, { error: 'Origen no autorizado.' });
  if (loginRateLimited(req)) return sendJson(res, 429, { error: 'Demasiados intentos. Espera 15 minutos y vuelve a intentar.' });

  const body = readBody(req);
  const username = String(body?.username || '').trim().toLowerCase();
  const account = adminAccount(username);
  if (!account || !account.password || !safePasswordEqual(body?.password || '', account.password)) {
    return sendJson(res, 401, { error: 'Usuario o clave incorrectos.' });
  }

  try {
    res.setHeader('Set-Cookie', sessionCookie(username, account.name, req));
    return sendJson(res, 200, { user: { username, name: account.name } });
  } catch {
    return sendJson(res, 503, { error: 'El acceso aún no está configurado en el servidor.' });
  }
}
