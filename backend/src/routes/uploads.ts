import { Router } from 'express';
import { z } from 'zod';
import { createTicket, verifyTicket, blobEnabled } from '../services/blob.js';
import { requestAccess } from '../middleware/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { limit } from '../middleware/rate-limit.js';
export const uploadsRouter = Router();
uploadsRouter.get('/config', (_req, res) => res.json({ direct: blobEnabled() }));
uploadsRouter.post('/tickets', limit('upload-tickets', 100, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const input = z.object({ fileName: z.string().min(1).max(200), fileType: z.string().max(100), fileSize: z.number().int().positive().max(20 * 1024 * 1024), requestId: z.number().int().positive().optional() }).strict().parse(req.body);
  if (input.requestId) { if (!req.user) throw new HttpError(401, 'Войдите в CRM.'); await requestAccess(req, input.requestId); }
  else if (req.user?.role === 'MECHANIC') throw new HttpError(403, 'Создание заявок доступно менеджеру.');
  res.status(201).json(await createTicket(req, input));
}));
uploadsRouter.post('/tickets/:id/complete', asyncRoute(async (req, res) => { await verifyTicket(req, z.string().uuid().parse(req.params.id)); res.json({ ok: true }); }));
