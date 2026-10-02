import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../utils/db.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { auth, jwtSecret } from '../middleware/auth.js';
import { limit } from '../middleware/rate-limit.js';
import { audit } from '../services/security.js';
import { secureCookies, csrfToken } from '../middleware/csrf.js';
export const authRouter = Router();
authRouter.get('/csrf', csrfToken);
authRouter.post(
  '/login',
  limit('login-ip', 30, 15 * 60 * 1000),
  limit('login-account', 15, 15 * 60 * 1000, (req) => typeof req.body?.email === 'string' ? req.body.email.toLowerCase().slice(0, 254) : 'invalid'),
  asyncRoute(async (req, res) => {
    const { email, password } = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Пароль превышает 72 байта UTF-8'),
      })
      .parse(req.body);
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) {
      await audit(req, 'LOGIN_FAILED', undefined, 401);
      throw new HttpError(401, 'Неверный email или пароль.');
    }
    const sessionId = randomUUID();
    await db.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!current.active || current.passwordHash !== user.passwordHash || current.sessionVersion !== user.sessionVersion) throw new HttpError(401, 'Повторите вход.');
      await tx.session.create({ data: { id: sessionId, userId: user.id, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) } });
    });
    const token = jwt.sign({ version: user.sessionVersion }, jwtSecret!, {
      subject: user.id,
      jwtid: sessionId,
      expiresIn: '12h',
      algorithm: 'HS256',
    });
    res.cookie('drivecore_session', token, {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    await audit(req, 'LOGIN_SUCCESS', user.id, 200);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }),
);
authRouter.get('/me', auth, (req, res) => res.json(req.user));
authRouter.post('/logout', asyncRoute(async (req, res) => {
  if (req.sessionId) await db.session.deleteMany({ where: { id: req.sessionId } });
  await audit(req, 'LOGOUT', req.user?.id, 200);
  res.clearCookie('drivecore_session', { path: '/', httpOnly: true, secure: secureCookies(), sameSite: 'lax' });
  res.clearCookie('drivecore_csrf', { path: '/', httpOnly: true, secure: secureCookies(), sameSite: 'strict' });
  res.json({ ok: true });
}));
