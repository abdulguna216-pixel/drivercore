import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../utils/db.js';
import { auth, roles } from '../middleware/auth.js';
import { asyncRoute } from '../utils/errors.js';
import { requestInclude } from '../services/requests.js';
export const dashboardRouter = Router();
dashboardRouter.use(auth);
const dayKey = (value: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
dashboardRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const now = new Date(),
      today = dayKey(now),
      start = new Date(`${today}T00:00:00+03:00`),
      end = new Date(start.getTime() + 86400000);
    const where: Prisma.RequestWhereInput =
      req.user!.role === 'MECHANIC' ? { mechanicId: req.user!.id } : {};
    const [counts, appointments, recent, requests, payments, tasks] = await Promise.all([
      db.request.groupBy({ by: ['status'], where, _count: true }),
      db.appointment.findMany({
        where: {
          cancelled: false,
          startsAt: { gte: start, lt: end },
          ...(req.user!.role === 'MECHANIC' ? { mechanicId: req.user!.id } : {}),
        },
        include: {
          request: { include: requestInclude },
          mechanic: { select: { name: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
      db.request.findMany({
        where,
        include: requestInclude,
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      db.request.findMany({
        where: {
          ...where,
          createdAt: { gte: new Date(start.getTime() - 6 * 86400000) },
        },
        select: { createdAt: true },
      }),
      req.user!.role === 'MECHANIC'
        ? Promise.resolve([])
        : db.payment.findMany({
            where: {
              createdAt: {
                gte: new Date(`${today.slice(0, 7)}-01T00:00:00+03:00`),
              },
            },
          }),
      db.task.findMany({
        where: {
          status: { not: 'DONE' },
          ...(req.user!.role === 'MECHANIC' ? { assigneeId: req.user!.id } : {}),
        },
        include: {
          assignee: { select: { name: true } },
          request: { include: { car: true } },
        },
        orderBy: { dueAt: 'asc' },
        take: 5,
      }),
    ]);
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const day = dayKey(new Date(start.getTime() - (6 - i) * 86400000));
      return {
        date: day,
        label: day.slice(8),
        count: requests.filter((r) => dayKey(r.createdAt) === day).length,
      };
    });
    res.json({
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
      today: appointments.length,
      appointments,
      recent,
      tasks,
      weekly,
      revenue: payments.reduce((sum, p) => sum + Number(p.amount), 0),
    });
  }),
);
export const analyticsRouter = Router();
analyticsRouter.use(auth, roles('ADMIN', 'MANAGER'));
analyticsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const days = Math.max(7, Math.min(365, Number(req.query.days) || 30)),
      since = new Date(Date.now() - days * 86400000);
    const [requests, clients, payments, orders] = await Promise.all([
      db.request.findMany({
        where: { createdAt: { gte: since } },
        include: { service: true },
      }),
      db.client.findMany({
        include: { _count: { select: { requests: true } } },
      }),
      db.payment.findMany({ where: { createdAt: { gte: since } } }),
      db.workOrder.findMany({
        where: { status: 'COMPLETED', updatedAt: { gte: since } },
      }),
    ]);
    const completed = requests.filter((r) => r.status === 'COMPLETED').length;
    const serviceCounts = new Map<string, number>(),
      sources = new Map<string, number>();
    requests.forEach((r) => {
      serviceCounts.set(r.service.name, (serviceCounts.get(r.service.name) || 0) + 1);
      sources.set(r.source, (sources.get(r.source) || 0) + 1);
    });
    res.json({
      days,
      requests: requests.length,
      newClients: clients.filter((c) => c.createdAt >= since).length,
      repeatClients: clients.filter((c) => c._count.requests > 1).length,
      completedOrders: orders.length,
      averageCheck: orders.length
        ? orders.reduce((s, o) => s + Number(o.total), 0) / orders.length
        : 0,
      revenue: payments.reduce((s, p) => s + Number(p.amount), 0),
      conversion: requests.length ? (completed / requests.length) * 100 : 0,
      services: [...serviceCounts]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      sources: [...sources].map(([name, count]) => ({ name, count })),
    });
  }),
);
export const searchRouter = Router();
searchRouter.use(auth);
searchRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').slice(0, 100);
    if (q.length < 2) {
      res.json({ requests: [], clients: [], cars: [], orders: [] });
      return;
    }
    const requestWhere: Prisma.RequestWhereInput = {
      ...(req.user!.role === 'MECHANIC' ? { mechanicId: req.user!.id } : {}),
      OR: [
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { client: { phone: { contains: q.replace(/\s/g, '') } } },
        { car: { vin: { contains: q, mode: 'insensitive' } } },
        { car: { licensePlate: { contains: q, mode: 'insensitive' } } },
        ...(/^#?\d+$/.test(q) ? [{ id: Number(q.replace('#', '')) }] : []),
      ],
    };
    const [requests, clients, cars, orders] = await Promise.all([
      db.request.findMany({
        where: requestWhere,
        include: requestInclude,
        take: 8,
      }),
      req.user!.role === 'MECHANIC'
        ? Promise.resolve([])
        : db.client.findMany({
            where: {
              OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }],
            },
            take: 5,
          }),
      db.car.findMany({
        where: {
          ...(req.user!.role === 'MECHANIC'
            ? { requests: { some: { mechanicId: req.user!.id } } }
            : {}),
          OR: [
            { vin: { contains: q, mode: 'insensitive' } },
            { licensePlate: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
      db.workOrder.findMany({
        where: {
          ...(req.user!.role === 'MECHANIC' ? { request: { mechanicId: req.user!.id } } : {}),
          ...(/^(?:WO-)?\d+$/.test(q)
            ? { id: Number(q.replace('WO-', '')) }
            : { client: { name: { contains: q, mode: 'insensitive' } } }),
        },
        include: { car: true, client: true },
        take: 5,
      }),
    ]);
    res.json({ requests, clients, cars, orders });
  }),
);
export const notificationsRouter = Router();
notificationsRouter.use(auth);
notificationsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where: { userId: req.user!.id },
        take: 25,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);
    res.json({ items, unread });
  }),
);
notificationsRouter.patch(
  '/read',
  asyncRoute(async (req, res) => {
    await db.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
