import type { Request, RequestHandler } from 'express';
import { db } from '../utils/db.js';
import { fingerprint, audit } from '../services/security.js';
import { asyncRoute, HttpError } from '../utils/errors.js';

export function limit(scope: string, maximum: number, windowMs: number, key?: (req: Request) => string): RequestHandler {
  return asyncRoute(async (req, res, next) => {
    const now = Date.now();
    const bucketKey = `${scope}:${fingerprint(key ? key(req) : req.ip || req.socket.remoteAddress || 'unknown')}:${Math.floor(now / windowMs)}`;
    const bucket = await db.rateBucket.upsert({ where: { key: bucketKey }, create: { key: bucketKey, expiresAt: new Date((Math.floor(now / windowMs) + 1) * windowMs) }, update: { count: { increment: 1 } } });
    if (bucket.count > maximum) {
      res.setHeader('Retry-After', Math.ceil((bucket.expiresAt.getTime() - now) / 1000));
      await audit(req, 'RATE_LIMITED', undefined, 429);
      throw new HttpError(429, 'Слишком много попыток. Повторите позже.');
    }
    next();
  });
}
