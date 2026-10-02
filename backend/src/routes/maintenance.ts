import { Router } from 'express';
import { sameSecret } from '../utils/constant-time.js';
import { del } from '@vercel/blob';
import { db } from '../utils/db.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
export const maintenanceRouter = Router();
maintenanceRouter.get('/maintenance', asyncRoute(async (req, res) => {
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '', given = req.get('authorization') || '';
  if (!expected || !sameSecret(expected, given)) throw new HttpError(401, 'Недопустимый доступ.');
  const expired = await db.uploadTicket.findMany({ where: { usedAt: null, expiresAt: { lt: new Date() } }, take: 100 });
  for (const ticket of expired) { await del(ticket.pathname); await db.uploadTicket.delete({ where: { id: ticket.id } }); }
  await Promise.all([
    db.rateBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    db.uploadTicket.deleteMany({ where: { usedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    db.securityEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } } }),
  ]);
  res.json({ ok: true, removedUploads: expired.length });
}));
