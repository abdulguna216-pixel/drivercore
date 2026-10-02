import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { audit } from '../services/security.js';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export const asyncRoute =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
export async function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ message: 'Некорректный формат запроса.' });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Проверьте заполненные поля.',
      fields: error.flatten().fieldErrors,
    });
    return;
  }
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) await audit(req, 'ACCESS_DENIED', undefined, error.status);
    if (error.status === 413 || error.status === 507) await audit(req, 'STORAGE_LIMIT', undefined, error.status);
    res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
    return;
  }
  if (error instanceof multer.MulterError) {
    await audit(req, 'UPLOAD_REJECTED', undefined, 400);
    res.status(400).json({
      message: 'Не удалось загрузить файлы. Максимум 5 файлов, каждый до 20 МБ.',
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Такая запись уже существует.' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Запись не найдена.' });
      return;
    }
    if (error.code === 'P2003') {
      res.status(409).json({ message: 'У записи есть связанные данные.' });
      return;
    }
    if (
      error.code === 'P2034' ||
      String(error.meta?.database_error).includes('overlap') ||
      String(error.message).includes('appointment_no_overlap')
    ) {
      res.status(409).json({
        message: 'Мастер уже занят в это время. Выберите другое время.',
      });
      return;
    }
  }
  await audit(req, 'SERVER_ERROR', undefined, 500);
  res.status(500).json({ message: 'Не удалось выполнить действие. Попробуйте ещё раз.' });
}
