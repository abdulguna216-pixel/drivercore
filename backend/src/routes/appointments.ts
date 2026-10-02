import { Router } from 'express';
import { db } from '../utils/db.js';
import { auth, roles, requestAccess } from '../middleware/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { appointmentSchema, datetime } from '../utils/validation.js';
import { requestInclude, log, lockRequest } from '../services/requests.js';
export const appointmentsRouter = Router();
appointmentsRouter.use(auth);
appointmentsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    res.json(
      await db.appointment.findMany({
        where: {
          OR: [{ cancelled: false }, { request: { status: 'COMPLETED' } }],
          ...(req.user!.role === 'MECHANIC' ? { mechanicId: req.user!.id } : {}),
          ...(req.query.from || req.query.to
            ? {
                startsAt: {
                  ...(req.query.from ? { gte: new Date(datetime.parse(req.query.from)) } : {}),
                  ...(req.query.to ? { lt: new Date(datetime.parse(req.query.to)) } : {}),
                },
              }
            : {}),
        },
        include: {
          mechanic: { select: { id: true, name: true } },
          request: { include: requestInclude },
        },
        orderBy: { startsAt: 'asc' },
      }),
    );
  }),
);
const schedule = asyncRoute(async (req, res) => {
  let body = req.body;
  if (req.params.id) {
    const previous = await db.appointment.findUnique({
      where: { id: req.params.id },
    });
    if (!previous) throw new HttpError(404, 'Запись не найдена.');
    body = {
      mechanicId: previous.mechanicId,
      startsAt: previous.startsAt.toISOString(),
      endsAt: previous.endsAt.toISOString(),
      ...req.body,
      requestId: previous.requestId,
    };
  }
  const data = appointmentSchema.parse(body);
  await requestAccess(req, data.requestId);
  const mechanic = await db.user.findFirst({
    where: { id: data.mechanicId, role: 'MECHANIC', active: true },
  });
  if (!mechanic) throw new HttpError(400, 'Выберите действующего мастера.');
  const result = await db.$transaction(async (tx) => {
    await lockRequest(tx, data.requestId);
    const record = (await tx.request.findUnique({
      where: { id: data.requestId },
    }))!;
    if (['COMPLETED', 'CANCELLED'].includes(record.status))
      throw new HttpError(400, 'Завершённую или отменённую заявку нельзя записать.');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.mechanicId}))`;
    const overlap = await tx.appointment.findFirst({
      where: {
        mechanicId: data.mechanicId,
        cancelled: false,
        requestId: { not: data.requestId },
        startsAt: { lt: new Date(data.endsAt) },
        endsAt: { gt: new Date(data.startsAt) },
      },
    });
    if (overlap) throw new HttpError(409, 'Мастер уже занят в это время. Выберите другое время.');
    const dates = {
      mechanicId: data.mechanicId,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      cancelled: false,
    };
    const appointment = await tx.appointment.upsert({
      where: { requestId: data.requestId },
      create: { requestId: data.requestId, ...dates },
      update: dates,
    });
    await tx.request.update({
      where: { id: data.requestId },
      data: {
        mechanicId: data.mechanicId,
        status: ['NEW', 'CONTACTED', 'SCHEDULED'].includes(record.status)
          ? 'SCHEDULED'
          : record.status,
      },
    });
    await log(
      tx,
      data.requestId,
      req.user!.id,
      'APPOINTMENT',
      `Назначен мастер ${mechanic.name}. Запись: ${new Date(data.startsAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
    );
    return appointment;
  });
  res.status(req.params.id ? 200 : 201).json(result);
});
appointmentsRouter.post('/', roles('ADMIN', 'MANAGER'), schedule);
appointmentsRouter.patch('/:id', roles('ADMIN', 'MANAGER'), schedule);
