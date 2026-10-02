import { Prisma, type Request as DbRequest } from '@prisma/client';
import { db } from '../utils/db.js';
import { HttpError } from '../utils/errors.js';
import { statusLabels } from '../../../shared/constants.js';
import type { SessionUser } from '../middleware/auth.js';
export const requestInclude = {
  client: true,
  car: true,
  service: true,
  manager: { select: { id: true, name: true } },
  mechanic: { select: { id: true, name: true } },
  appointment: true,
  workOrder: {
    include: {
      items: true,
      payments: { include: { user: { select: { name: true } } } },
    },
  },
} as const;
export const detailInclude = {
  ...requestInclude,
  comments: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  files: true,
  tasks: {
    include: { assignee: { select: { name: true } } },
    orderBy: { dueAt: 'asc' as const },
  },
  activities: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};
export const log = (
  tx: Prisma.TransactionClient,
  requestId: number,
  userId: string | undefined,
  type: string,
  description: string,
) => tx.activityLog.create({ data: { requestId, userId, type, description } });
export async function changeStatus(
  tx: Prisma.TransactionClient,
  record: DbRequest,
  status: DbRequest['status'],
  user: SessionUser,
) {
  if (user.role === 'MECHANIC' && !['IN_PROGRESS', 'READY'].includes(status))
    throw new HttpError(403, 'Мастер может начать работу или отметить готовность.');
  if (status === 'SCHEDULED') {
    const appointment = await tx.appointment.findUnique({
      where: { requestId: record.id },
    });
    if (!appointment || appointment.cancelled)
      throw new HttpError(400, 'Сначала назначьте время и мастера.');
  }
  if (status === 'COMPLETED') {
    const order = await tx.workOrder.findUnique({
      where: { requestId: record.id },
      include: { payments: true, items: true },
    });
    if (!order || !order.items.length)
      throw new HttpError(400, 'Создайте и заполните заказ-наряд перед завершением.');
    const paid = order.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    if (paid.lessThan(order.total))
      throw new HttpError(400, 'Для завершения необходимо погасить остаток оплаты.');
  }
  if (record.status !== status) {
    await tx.request.update({ where: { id: record.id }, data: { status } });
    await tx.workOrder.updateMany({
      where: { requestId: record.id },
      data: { status },
    });
    await tx.appointment.updateMany({
      where: { requestId: record.id },
      data: { cancelled: ['CANCELLED', 'COMPLETED'].includes(status) },
    });
    await log(
      tx,
      record.id,
      user.id,
      'STATUS',
      `Статус изменён: ${statusLabels[record.status]} → ${statusLabels[status]}`,
    );
  }
}
export async function lockRequest(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${id} FOR UPDATE`;
}
