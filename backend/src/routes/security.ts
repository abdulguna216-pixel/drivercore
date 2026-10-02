import { Router } from 'express';
import { auth, roles } from '../middleware/auth.js';
import { db } from '../utils/db.js';
import { asyncRoute } from '../utils/errors.js';
export const securityRouter = Router();
securityRouter.use(auth, roles('ADMIN'));
securityRouter.get('/', asyncRoute(async (_req, res) => {
  const [events, alerts] = await Promise.all([
    db.securityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, type: true, actorId: true, targetId: true, requestId: true, status: true, createdAt: true } }),
    db.securityAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, type: true, severity: true, count: true, acknowledgedAt: true, createdAt: true } }),
  ]);
  res.json({ events, alerts });
}));
securityRouter.patch('/alerts/:id', asyncRoute(async (req, res) => {
  await db.securityAlert.update({ where: { id: req.params.id }, data: { acknowledgedAt: new Date() } });
  res.json({ ok: true });
}));
