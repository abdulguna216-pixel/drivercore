import type { Request, Response, RequestHandler } from 'express';
import { createHmac, randomBytes } from 'node:crypto';
import { sameSecret } from '../utils/constant-time.js';
import { HttpError, asyncRoute } from '../utils/errors.js';
import { audit } from '../services/security.js';

export const secureCookies = () => process.env.NODE_ENV === 'production';
const ttl = 15 * 60 * 1000;
function signature(req: Request, value: string) {
  return createHmac('sha256', process.env.JWT_SECRET!).update(value).update('\0').update(req.cookies?.drivecore_session || '').digest('base64url');
}
function token(req: Request): string | undefined {
  const value = req.cookies?.drivecore_csrf;
  if (typeof value !== 'string') return;
  const [random, timestamp, sig] = value.split('.');
  if (!random || !/^\d+$/.test(timestamp || '') || !sig || Date.now() - Number(timestamp) > ttl || Number(timestamp) > Date.now()) return;
  const expected = signature(req, `${random}.${timestamp}`);
  if (sameSecret(sig, expected)) return random;
}
export function csrfToken(req: Request, res: Response) {
  let current = token(req);
  if (!current) {
    current = randomBytes(32).toString('base64url');
    const payload = `${current}.${Date.now()}`;
    res.cookie('drivecore_csrf', `${payload}.${signature(req, payload)}`, { httpOnly: true, secure: secureCookies(), sameSite: 'strict', maxAge: ttl, path: '/' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ token: current });
}
export const csrfProtection: RequestHandler = asyncRoute(async (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
  const current = token(req), provided = req.get('X-CSRF-Token');
  if (!current || !provided || !sameSecret(current, provided)) {
    await audit(req, 'CSRF_DENIED', undefined, 403);
    throw new HttpError(403, 'Защита формы: обновите страницу и повторите действие.', 'CSRF_INVALID');
  }
  next();
});
