import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { db } from '../utils/db.js';
import { auth, roles, staffSelect } from '../middleware/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { phone, text, optionalText, money, pagination, password as passwordSchema } from '../utils/validation.js';
import { audit } from '../services/security.js';
import { requestInclude } from '../services/requests.js';
export const clientsRouter = Router();
clientsRouter.use(auth, roles('ADMIN', 'MANAGER'));
const clientSchema = z.object({
  name: text(100),
  phone,
  email: z
    .string()
    .email()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
});
clientsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = pagination(req.query),
      q = String(req.query.q || '');
    const where: Prisma.ClientWhereInput = q
      ? {
          OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }],
        }
      : {};
    const [items, total] = await Promise.all([
      db.client.findMany({
        where,
        include: {
          cars: true,
          requests: {
            select: {
              id: true,
              createdAt: true,
              status: true,
              appointment: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          workOrders: { include: { payments: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      db.client.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
clientsRouter.post(
  '/',
  asyncRoute(async (req, res) =>
    res.status(201).json(await db.client.create({ data: clientSchema.parse(req.body) })),
  ),
);
clientsRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const record = await db.client.findUnique({
      where: { id: req.params.id },
      include: {
        cars: true,
        requests: { include: requestInclude, orderBy: { createdAt: 'desc' } },
        workOrders: { include: { payments: true } },
      },
    });
    if (!record) throw new HttpError(404, 'Клиент не найден.');
    res.json(record);
  }),
);
clientsRouter.patch(
  '/:id',
  asyncRoute(async (req, res) =>
    res.json(
      await db.client.update({
        where: { id: req.params.id },
        data: clientSchema.partial().parse(req.body),
      }),
    ),
  ),
);
export const carsRouter = Router();
carsRouter.use(auth);
const carSchema = z.object({
  clientId: text(100),
  brand: text(80),
  model: text(80),
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .nullable()
    .optional(),
  vin: z
    .string()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/)
    .nullable()
    .optional(),
  licensePlate: optionalText(20),
  mileage: z.coerce.number().int().min(0).max(3000000).nullable().optional(),
});
carsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = pagination(req.query),
      q = String(req.query.q || '');
    const where: Prisma.CarWhereInput = {
      ...(req.user!.role === 'MECHANIC'
        ? { requests: { some: { mechanicId: req.user!.id } } }
        : {}),
      ...(q
        ? {
            OR: [
              { brand: { contains: q, mode: 'insensitive' } },
              { model: { contains: q, mode: 'insensitive' } },
              { licensePlate: { contains: q, mode: 'insensitive' } },
              { vin: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.car.findMany({
        where,
        include: { client: true, _count: { select: { requests: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.car.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
carsRouter.post(
  '/',
  roles('ADMIN', 'MANAGER'),
  asyncRoute(async (req, res) =>
    res.status(201).json(await db.car.create({ data: carSchema.parse(req.body) })),
  ),
);
carsRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const car = await db.car.findFirst({
      where: {
        id: req.params.id,
        ...(req.user!.role === 'MECHANIC'
          ? { requests: { some: { mechanicId: req.user!.id } } }
          : {}),
      },
      include: {
        client: true,
        requests: {
          where: req.user!.role === 'MECHANIC' ? { mechanicId: req.user!.id } : {},
          include: requestInclude,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!car) throw new HttpError(404, 'Автомобиль не найден.');
    res.json(car);
  }),
);
carsRouter.patch(
  '/:id',
  roles('ADMIN', 'MANAGER'),
  asyncRoute(async (req, res) =>
    res.json(
      await db.car.update({
        where: { id: req.params.id },
        data: carSchema.partial().parse(req.body),
      }),
    ),
  ),
);
export const usersRouter = Router();
usersRouter.use(auth);
usersRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const users = await db.user.findMany({
      select: {
        ...staffSelect,
        _count: {
          select: {
            mechanicRequests: {
              where: { status: { in: ['SCHEDULED', 'IN_PROGRESS', 'READY'] } },
            },
          },
        },
      },
      orderBy: { role: 'asc' },
    });
    res.json(users);
  }),
);
const userSchema = z.object({
  name: text(100),
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  role: z.enum(['ADMIN', 'MANAGER', 'MECHANIC']),
  password: passwordSchema,
  active: z.boolean().optional(),
});
usersRouter.post(
  '/',
  roles('ADMIN'),
  asyncRoute(async (req, res) => {
    const { password, ...data } = userSchema.parse(req.body);
    const created = await db.user.create({
        data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
        select: staffSelect,
      });
    await audit(req, 'USER_CREATED', created.id, 201);
    res.status(201).json(created);
  }),
);
usersRouter.patch(
  '/:id',
  roles('ADMIN'),
  asyncRoute(async (req, res) => {
    const data = userSchema.partial().parse(req.body);
    if (
      req.params.id === req.user!.id &&
      (data.active === false || (data.role && data.role !== 'ADMIN'))
    )
      throw new HttpError(400, 'Нельзя отключить или понизить собственную учётную запись.');
    const { password, ...rest } = data;
    const updated = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
          ...((password || data.role || data.active !== undefined) ? { sessionVersion: { increment: 1 } } : {}),
        },
        select: staffSelect,
      });
      if (password || data.role || data.active !== undefined) await tx.session.deleteMany({ where: { userId: req.params.id } });
      return updated;
    });
    await audit(req, password ? 'PASSWORD_CHANGED' : 'USER_CHANGED', updated.id, 200);
    res.json(updated);
  }),
);
export const servicesRouter = Router();
servicesRouter.get(
  '/',
  asyncRoute(async (req, res) =>
    res.json(
      await db.service.findMany({
        where: req.user?.role === 'ADMIN' ? {} : { active: true },
        orderBy: { name: 'asc' },
      }),
    ),
  ),
);
const serviceSchema = z.object({
  name: text(150),
  description: text(1000),
  price: money,
  duration: z.coerce.number().int().min(15).max(1440),
  active: z.boolean().optional(),
});
servicesRouter.post(
  '/',
  auth,
  roles('ADMIN'),
  asyncRoute(async (req, res) =>
    res.status(201).json(await db.service.create({ data: serviceSchema.parse(req.body) })),
  ),
);
servicesRouter.patch(
  '/:id',
  auth,
  roles('ADMIN'),
  asyncRoute(async (req, res) =>
    res.json(
      await db.service.update({
        where: { id: req.params.id },
        data: serviceSchema.partial().parse(req.body),
      }),
    ),
  ),
);
export const settingsRouter = Router();
settingsRouter.get(
  '/',
  asyncRoute(async (_req, res) =>
    res.json(
      await db.setting.upsert({
        where: { id: 'main' },
        create: { id: 'main' },
        update: {},
      }),
    ),
  ),
);
settingsRouter.patch(
  '/',
  auth,
  roles('ADMIN'),
  asyncRoute(async (req, res) =>
    res.json(
      await db.setting.update({
        where: { id: 'main' },
        data: z
          .object({
            name: text(100),
            phone: text(50),
            address: text(300),
            hours: text(200),
            email: z.string().email(),
          })
          .parse(req.body),
      }),
    ),
  ),
);
