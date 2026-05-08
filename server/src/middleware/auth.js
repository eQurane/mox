import jwt from 'jsonwebtoken';
import { jwtSecret } from '../jwtSecret.js';

export function bearerToken(req) {
  const h = req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

export function requireAuth(req, res, next) {
  const raw = bearerToken(req);
  if (!raw) {
    return res.status(401).json({ error: 'Требуется авторизация.' });
  }

  let payload;
  try {
    payload = jwt.verify(raw, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Сессия недействительна.' });
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(401).json({ error: 'Сессия недействительна.' });
  }

  const roleId = Number(payload.roleId);
  req.userId = userId;
  req.roleId = Number.isInteger(roleId) && roleId >= 1 ? roleId : null;
  next();
}
