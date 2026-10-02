import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { limit } from '../middleware/rate-limit.js';
import path from 'node:path';
import { Readable } from 'node:stream';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { get as getBlob, del as deleteBlob } from '@vercel/blob';
import { audit } from '../services/security.js';
import { consumeTickets } from '../services/blob.js';
import { db } from '../utils/db.js';
import { auth, roles, requestAccess } from '../middleware/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { createRequestSchema, pagination, id, text, date, datetime } from '../utils/validation.js';
import {
  requestInclude,
  detailInclude,
  log,
  changeStatus,
  lockRequest,
} from '../services/requests.js';
import { upload, verifyFiles, cleanup, metadata, uploadDir, releaseUpload } from '../services/files.js';
import { notifyTelegram } from '../services/telegram.js';
import { statuses } from '../../../shared/constants.js';
export const requestsRouter = Router();
requestsRouter.post(
  '/',
  limit('requests', 30, 60 * 60 * 1000),
  (req, _res, next) => req.user?.role === 'MECHANIC' ? next(new HttpError(403, 'Создание заявок доступно менеджеру.')) : next(),
  upload,
  asyncRoute(async (req, res) => {
    if (req.files && !Array.isArray(req.files)) throw new HttpError(400, 'Некорректный список файлов.');
    const files = Array.isArray(req.files) ? req.files : [];
    try {
      await verifyFiles(files, !req.user);
      const raw = { ...req.body };
      for (const key of ['year', 'mileage', 'vin', 'preferredDate'])
        if (raw[key] === '') delete raw[key];
      const data = createRequestSchema.parse(raw);
      const attachmentIds = z.array(z.string().uuid()).max(5).parse(raw.attachmentIds || []);
      if (req.user?.role === 'MECHANIC')
        throw new HttpError(403, 'Создание заявок доступно менеджеру.');
      const service = await db.service.findFirst({
        where: {
          ...(data.serviceId
            ? { id: data.serviceId }
            : {
                name:
                  data.service === 'Замена тормозных колодок' ? 'Тормозная система' : data.service,
              }),
          active: true,
        },
      });
      if (!service) throw new HttpError(400, 'Выберите доступную услугу.');
      const record = await db.$transaction(async (tx) => {
        const attachments = await consumeTickets(tx, req, attachmentIds);
        const client = await tx.client.upsert({
          where: { phone: data.phone },
          create: { name: data.name, phone: data.phone },
          update: {},
        });
        const plate = data.licensePlate?.toUpperCase();
        let car = await tx.car.findFirst({
          where: {
            clientId: client.id,
            brand: { equals: data.carBrand, mode: 'insensitive' },
            model: { equals: data.carModel, mode: 'insensitive' },
            ...(plate ? { licensePlate: plate } : {}),
          },
        });
        if (!car)
          car = await tx.car.create({
            data: {
              clientId: client.id,
              brand: data.carBrand,
              model: data.carModel,
              year: data.year,
              licensePlate: plate,
              vin: data.vin,
              mileage: data.mileage,
            },
          });
        const record = await tx.request.create({
          data: {
            clientId: client.id,
            carId: car.id,
            serviceId: service.id,
            preferredDate: data.preferredDate ? new Date(data.preferredDate) : undefined,
            comment: data.comment,
            source: req.user ? data.source || 'manual' : 'website',
            managerId: req.user?.id,
            files: { create: [...files.map(metadata), ...attachments] },
          },
          include: requestInclude,
        });
        await log(
          tx,
          record.id,
          req.user?.id,
          'CREATED',
          req.user ? 'Создана заявка сотрудником' : 'Создана заявка с сайта',
        );
        const recipients = await tx.user.findMany({
          where: { role: { in: ['ADMIN', 'MANAGER'] }, active: true },
          select: { id: true },
        });
        await tx.notification.createMany({
          data: recipients.map((user) => ({
            userId: user.id,
            requestId: record.id,
            title: `Новая заявка #${record.id} · ${car.brand} ${car.model}`,
          })),
        });
        return record;
      });
      void notifyTelegram(record);
      await releaseUpload(req);
      res.status(201).json(
        req.user
          ? record
          : {
              id: record.id,
              message: 'Заявка отправлена. Мы свяжемся с вами для подтверждения записи.',
            },
      );
    } catch (error) {
      await cleanup(files);
      await releaseUpload(req);
      throw error;
    }
  }),
);
requestsRouter.get(
  '/',
  auth,
  asyncRoute(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const q = String(req.query.q || '').slice(0, 150);
    const where: Prisma.RequestWhereInput = {
      ...(req.user!.role === 'MECHANIC' ? { mechanicId: req.user!.id } : {}),
      ...(req.query.status ? { status: z.enum(statuses).parse(req.query.status) } : {}),
      ...(req.query.source
        ? {
            source: z.enum(['website', 'phone', 'telegram', 'manual']).parse(req.query.source),
          }
        : {}),
      ...(req.query.managerId ? { managerId: String(req.query.managerId) } : {}),
      ...(req.query.mechanicId ? { mechanicId: String(req.query.mechanicId) } : {}),
      ...(req.query.serviceId ? { serviceId: String(req.query.serviceId) } : {}),
      ...(req.query.date ? { preferredDate: new Date(date.parse(req.query.date)) } : {}),
      ...(q
        ? {
            OR: [
              { client: { name: { contains: q, mode: 'insensitive' } } },
              { client: { phone: { contains: q.replace(/\s/g, '') } } },
              { car: { licensePlate: { contains: q, mode: 'insensitive' } } },
              { car: { vin: { contains: q, mode: 'insensitive' } } },
              { car: { brand: { contains: q, mode: 'insensitive' } } },
              { car: { model: { contains: q, mode: 'insensitive' } } },
              ...(/^#?\d+$/.test(q) ? [{ id: Number(q.replace('#', '')) }] : []),
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.request.findMany({
        where,
        include: requestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.request.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
requestsRouter.get(
  '/:id',
  auth,
  asyncRoute(async (req, res) => {
    const requestId = id.parse(req.params.id);
    await requestAccess(req, requestId);
    res.json(
      await db.request.findUnique({
        where: { id: requestId },
        include: detailInclude,
      }),
    );
  }),
);
requestsRouter.patch(
  '/:id',
  auth,
  asyncRoute(async (req, res) => {
    const requestId = id.parse(req.params.id);
    await requestAccess(req, requestId);
    const data = z
      .object({
        status: z.enum(statuses).optional(),
        comment: z.string().trim().max(4000).optional(),
        preferredDate: date.nullable().optional(),
        managerId: z.string().nullable().optional(),
      })
      .strict()
      .parse(req.body);
    if (req.user!.role === 'MECHANIC' && Object.keys(data).some((k) => k !== 'status'))
      throw new HttpError(403, 'Мастер может менять только статус своей работы.');
    if (
      data.managerId &&
      !(await db.user.findFirst({
        where: {
          id: data.managerId,
          role: { in: ['ADMIN', 'MANAGER'] },
          active: true,
        },
      }))
    )
      throw new HttpError(400, 'Выберите действующего менеджера.');
    await db.$transaction(async (tx) => {
      await lockRequest(tx, requestId);
      const record = (await tx.request.findUnique({
        where: { id: requestId },
      }))!;
      if (data.status) await changeStatus(tx, record, data.status, req.user!);
      const { status, ...rest } = data;
      if (Object.keys(rest).length) {
        await tx.request.update({
          where: { id: requestId },
          data: {
            ...rest,
            preferredDate:
              data.preferredDate === null
                ? null
                : data.preferredDate
                  ? new Date(data.preferredDate)
                  : undefined,
          },
        });
        await log(tx, requestId, req.user!.id, 'UPDATED', 'Обновлены данные заявки');
      }
    });
    res.json(
      await db.request.findUnique({
        where: { id: requestId },
        include: detailInclude,
      }),
    );
  }),
);
requestsRouter.delete(
  '/:id',
  auth,
  roles('ADMIN'),
  asyncRoute(async (req, res) => {
    const requestId = id.parse(req.params.id);
    await requestAccess(req, requestId);
    const removedFiles = await db.$transaction(async (tx) => {
      await lockRequest(tx, requestId);
      if (await tx.workOrder.findUnique({ where: { requestId } }))
        throw new HttpError(409, 'У заявки есть заказ-наряд. Используйте статус «Отменена».');
      const files = await tx.file.findMany({ where: { requestId } });
      // Keep deleted cloud files in the quota until physical deletion succeeds.
      // An expired ticket lets maintenance retry if storage is temporarily unavailable.
      for (const file of files.filter((item) => item.fileUrl.startsWith('https://'))) {
        const pathname = decodeURIComponent(new URL(file.fileUrl).pathname.slice(1));
        await tx.uploadTicket.upsert({
          where: { pathname },
          create: { id: randomUUID(), ownerKey: 'cleanup', pathname, fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize, fileUrl: file.fileUrl, expiresAt: new Date(0) },
          update: { usedAt: null, expiresAt: new Date(0) },
        });
      }
      await log(tx, requestId, req.user!.id, 'DELETED', `Удалена заявка #${requestId}`);
      await tx.request.delete({ where: { id: requestId } });
      return files;
    });
    for (const file of removedFiles) {
      try {
        if (file.fileUrl.startsWith('https://')) {
          await deleteBlob(file.fileUrl);
          await db.uploadTicket.deleteMany({ where: { fileUrl: file.fileUrl, usedAt: null, expiresAt: { lt: new Date() } } });
        } else {
          await unlink(path.join(uploadDir, path.basename(file.fileUrl))).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
        }
      } catch { await audit(req, 'SERVER_ERROR', String(requestId), 500); }
    }
    res.json({ ok: true });
  }),
);
requestsRouter.post(
  '/:id/comments',
  auth,
  asyncRoute(async (req, res) => {
    const requestId = id.parse(req.params.id);
    await requestAccess(req, requestId);
    const data = z.object({ text: text(4000) }).parse(req.body);
    res.status(201).json(
      await db.$transaction(async (tx) => {
        const comment = await tx.comment.create({
          data: { ...data, requestId, userId: req.user!.id },
          include: { user: { select: { name: true } } },
        });
        await log(tx, requestId, req.user!.id, 'COMMENT', 'Добавлен комментарий');
        return comment;
      }),
    );
  }),
);
requestsRouter.post(
  '/:id/tasks',
  auth,
  roles('ADMIN', 'MANAGER'),
  asyncRoute(async (req, res) => {
    const requestId = id.parse(req.params.id);
    await requestAccess(req, requestId);
    const data = z
      .object({ title: text(300), assigneeId: text(100), dueAt: datetime })
      .parse(req.body);
    if (
      !(await db.user.findFirst({
        where: { id: data.assigneeId, active: true },
      }))
    )
      throw new HttpError(400, 'Выберите действующего сотрудника.');
    res.status(201).json(
      await db.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: { ...data, requestId, dueAt: new Date(data.dueAt) },
        });
        await log(tx, requestId, req.user!.id, 'TASK', `Создана задача: ${data.title}`);
        return task;
      }),
    );
  }),
);
requestsRouter.post(
  '/:id/files',
  auth,
  asyncRoute(async (req, _res, next) => { await requestAccess(req, id.parse(req.params.id)); next(); }),
  upload,
  asyncRoute(async (req, res) => {
    if (req.files && !Array.isArray(req.files)) throw new HttpError(400, 'Некорректный список файлов.');
    const files = Array.isArray(req.files) ? req.files : [];
    try {
      const requestId = id.parse(req.params.id);
      await requestAccess(req, requestId);
      const attachmentIds = z.array(z.string().uuid()).max(5).parse(req.body?.attachmentIds || []);
      if (!files.length && !attachmentIds.length) throw new HttpError(400, 'Выберите файл.');
      await verifyFiles(files);
      await db.$transaction(async (tx) => {
        const attachments = await consumeTickets(tx, req, attachmentIds, requestId);
        await tx.file.createMany({
          data: [...files.map(metadata), ...attachments].map((file) => ({ ...file, requestId })),
        });
        await log(tx, requestId, req.user!.id, 'FILES', `Добавлено файлов: ${files.length + attachments.length}`);
      });
      await releaseUpload(req);
      res.status(201).json({ ok: true });
    } catch (error) {
      await cleanup(files);
      await releaseUpload(req);
      throw error;
    }
  }),
);
export const filesRouter = Router();
filesRouter.get(
  '/:id/download',
  auth,
  asyncRoute(async (req, res) => {
    const file = await db.file.findUnique({ where: { id: req.params.id } });
    if (!file) throw new HttpError(404, 'Файл не найден.');
    await requestAccess(req, file.requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (file.fileUrl.startsWith('https://')) {
      const blob = await getBlob(file.fileUrl, { access: 'private' });
      if (!blob || blob.statusCode !== 200) throw new HttpError(404, 'Файл не найден.');
      res.attachment(file.fileName);
      res.setHeader('Content-Type', file.fileType);
      Readable.fromWeb(blob.stream as import('node:stream/web').ReadableStream<Uint8Array>).on('error', () => { res.destroy(); }).pipe(res);
      return;
    }
    res.download(path.join(uploadDir, path.basename(file.fileUrl)), file.fileName);
  }),
);
export const tasksRouter = Router();
tasksRouter.patch(
  '/:id',
  auth,
  asyncRoute(async (req, res) => {
    const task = await db.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw new HttpError(404, 'Задача не найдена.');
    await requestAccess(req, task.requestId);
    if (req.user!.role === 'MECHANIC' && task.assigneeId !== req.user!.id)
      throw new HttpError(403, 'Задача назначена другому сотруднику.');
    const { status } = z.object({ status: z.enum(['NEW', 'IN_PROGRESS', 'DONE']) }).parse(req.body);
    res.json(
      await db.$transaction(async (tx) => {
        const result = await tx.task.update({
          where: { id: task.id },
          data: { status },
        });
        await log(tx, task.requestId, req.user!.id, 'TASK', 'Изменён статус задачи');
        return result;
      }),
    );
  }),
);
