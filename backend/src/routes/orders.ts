import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '../utils/db.js';
import { auth, roles, requestAccess } from '../middleware/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { id, text, money, pagination } from '../utils/validation.js';
import { log, lockRequest } from '../services/requests.js';
export const orderInclude = {
  client: true,
  car: true,
  request: { include: { service: true } },
  items: true,
  payments: { include: { user: { select: { name: true } } } },
} as const;
export const ordersRouter = Router();
ordersRouter.use(auth);
ordersRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const where: Prisma.WorkOrderWhereInput =
      req.user!.role === 'MECHANIC' ? { request: { mechanicId: req.user!.id } } : {};
    const q = String(req.query.q || '');
    if (q)
      where.OR = [
        { client: { name: { contains: q, mode: 'insensitive' } } },
        ...(/^(?:WO-)?\d+$/.test(q) ? [{ id: Number(q.replace('WO-', '')) }] : []),
      ];
    const [items, total] = await Promise.all([
      db.workOrder.findMany({
        where,
        include: orderInclude,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.workOrder.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
ordersRouter.post(
  '/',
  roles('ADMIN', 'MANAGER'),
  asyncRoute(async (req, res) => {
    const requestId = id.parse(req.body.requestId);
    const record = await requestAccess(req, requestId);
    if (['COMPLETED', 'CANCELLED'].includes(record.status))
      throw new HttpError(400, 'Заявка уже закрыта.');
    res.status(201).json(
      await db.$transaction(async (tx) => {
        await lockRequest(tx, requestId);
        const order = await tx.workOrder.create({
          data: { requestId, clientId: record.clientId, carId: record.carId },
        });
        await log(tx, requestId, req.user!.id, 'WORK_ORDER', `Создан заказ-наряд #WO-${order.id}`);
        return order;
      }),
    );
  }),
);
ordersRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const order = await db.workOrder.findUnique({
      where: { id: id.parse(req.params.id) },
      include: orderInclude,
    });
    if (!order) throw new HttpError(404, 'Заказ-наряд не найден.');
    await requestAccess(req, order.requestId);
    res.json(order);
  }),
);
ordersRouter.put(
  '/:id/items',
  asyncRoute(async (req, res) => {
    const orderId = id.parse(req.params.id);
    const order = await db.workOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new HttpError(404, 'Заказ-наряд не найден.');
    await requestAccess(req, order.requestId);
    const { items } = z
      .object({
        items: z
          .array(
            z.object({
              kind: z.enum(['LABOR', 'PART']),
              name: text(200),
              quantity: money
                .refine((n) => n > 0, 'Количество должно быть положительным')
                .refine((n) => n <= 10000),
              price: money,
            }),
          )
          .max(100),
      })
      .parse(req.body);
    await db.$transaction(async (tx) => {
      await lockRequest(tx, order.requestId);
      await tx.$queryRaw`SELECT id FROM "WorkOrder" WHERE id = ${orderId} FOR UPDATE`;
      const current = (await tx.workOrder.findUnique({
        where: { id: orderId },
        include: { payments: true, items: true },
      }))!;
      if (current.status === 'COMPLETED')
        throw new HttpError(400, 'Завершённый заказ-наряд нельзя редактировать.');
      if (current.payments.length)
        throw new HttpError(400, 'После поступления оплаты состав заказа зафиксирован.');
      if (req.user!.role === 'MECHANIC') {
        const parts = items.filter((i) => i.kind === 'PART');
        const old = current.items.filter((i) => i.kind === 'PART');
        if (
          JSON.stringify(parts.map((i) => [i.name, i.quantity, i.price])) !==
          JSON.stringify(old.map((i) => [i.name, Number(i.quantity), Number(i.price)]))
        )
          throw new HttpError(403, 'Мастер может редактировать только работы.');
      }
      const total = items.reduce(
        (sum, item) =>
          sum.add(new Prisma.Decimal(item.quantity).mul(item.price).toDecimalPlaces(2)),
        new Prisma.Decimal(0),
      );
      if (total.greaterThan('9999999999.99'))
        throw new HttpError(400, 'Сумма заказа слишком велика. Проверьте количество и цены.');
      await tx.workOrderItem.deleteMany({ where: { workOrderId: orderId } });
      await tx.workOrder.update({
        where: { id: orderId },
        data: { total, subtotal: total, items: { create: items } },
      });
      await log(
        tx,
        order.requestId,
        req.user!.id,
        'ITEMS',
        `Обновлены работы и запчасти. Итого: ${total.toFixed(2)} ₽`,
      );
    });
    res.json(
      await db.workOrder.findUnique({
        where: { id: orderId },
        include: orderInclude,
      }),
    );
  }),
);
export const paymentsRouter = Router();
paymentsRouter.use(auth, roles('ADMIN', 'MANAGER'));
paymentsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const [items, total] = await Promise.all([
      db.payment.findMany({
        include: {
          workOrder: { include: { client: true, car: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      db.payment.count(),
    ]);
    res.json({ items, total, page, limit });
  }),
);
paymentsRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        workOrderId: id,
        amount: money.refine((n) => n > 0, 'Сумма должна быть положительной'),
        method: z.enum(['CASH', 'CARD', 'TRANSFER']),
      })
      .parse(req.body);
    const payment = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "WorkOrder" WHERE id = ${data.workOrderId} FOR UPDATE`;
      const order = await tx.workOrder.findUnique({
        where: { id: data.workOrderId },
        include: { payments: true },
      });
      if (!order) throw new HttpError(404, 'Заказ-наряд не найден.');
      if (order.status === 'CANCELLED') throw new HttpError(400, 'Заказ отменён.');
      const paid = order.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
      if (paid.add(data.amount).greaterThan(order.total))
        throw new HttpError(400, 'Сумма оплаты превышает остаток.');
      const payment = await tx.payment.create({
        data: { ...data, userId: req.user!.id },
      });
      await log(
        tx,
        order.requestId,
        req.user!.id,
        'PAYMENT',
        `Поступила оплата: ${data.amount.toFixed(2)} ₽`,
      );
      return payment;
    });
    res.status(201).json(payment);
  }),
);
