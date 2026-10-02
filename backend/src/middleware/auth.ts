import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { db } from '../utils/db.js';
import { HttpError } from '../utils/errors.js';
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
      securityRequestId?: string;
    }
  }
}
export const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32)
  throw new Error('JWT_SECRET must contain at least 32 characters. Configure .env.');
export async function identify(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.drivecore_session;
    if (token) {
      const payload = jwt.verify(token, jwtSecret!, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string' || typeof payload.version !== 'number') throw new jwt.JsonWebTokenError('Invalid session');
      const session = await db.session.findUnique({ where: { id: payload.jti }, include: { user: true } });
      if (!session || session.userId !== payload.sub || !session.user.active || session.expiresAt.getTime() <= Date.now() || session.user.sessionVersion !== payload.version) throw new jwt.JsonWebTokenError('Revoked session');
      const { id, name, email, role } = session.user;
      req.user = { id, name, email, role };
      req.sessionId = session.id;
    }
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      const { audit } = await import('../services/security.js');
      await audit(req, 'INVALID_SESSION', undefined, 401);
      next();
      return;
    }
    next(error);
  }
}
export const auth = (req: Request, _res: Response, next: NextFunction) =>
  req.user ? next() : next(new HttpError(401, 'Войдите в CRM.'));
export const roles =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && allowed.includes(req.user.role)
      ? next()
      : next(new HttpError(403, 'Недостаточно прав для этого действия.'));
export async function requestAccess(req: Request, id: number) {
  const record = await db.request.findUnique({ where: { id } });
  if (!record) throw new HttpError(404, 'Заявка не найдена.');
  if (req.user?.role === 'MECHANIC' && record.mechanicId !== req.user.id)
    throw new HttpError(403, 'Доступны только назначенные вам работы.');
  return record;
}
export const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;
