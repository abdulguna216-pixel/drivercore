import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { get, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from '../utils/db.js';
import { fingerprint, audit } from './security.js';
import { HttpError } from '../utils/errors.js';
import { imageTypes, fileTypes, validHeader } from './files.js';
export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const uploadOwner = (req: Request) => fingerprint(req.sessionId || req.cookies?.drivecore_csrf || 'missing');
const extensions: Record<string,string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf', 'video/mp4': '.mp4', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx' };
export async function createTicket(req: Request, input: { fileName: string; fileType: string; fileSize: number; requestId?: number }) {
  if (!blobEnabled()) throw new HttpError(400, 'Облачное хранилище не настроено.');
  if (!(req.user ? fileTypes : imageTypes).includes(input.fileType) || input.fileSize > (req.user ? 20 : 5) * 1024 * 1024) throw new HttpError(400, 'Недопустимый тип или размер файла.');
  const ticketId = randomUUID(), pathname = `attachments/${ticketId}${extensions[input.fileType]}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const quota = Number(process.env.UPLOAD_MAX_BYTES || 1024 * 1024 * 1024);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(716002)`;
    const [saved, reserved] = await Promise.all([tx.file.aggregate({ _sum: { fileSize: true } }), tx.uploadTicket.aggregate({ where: { usedAt: null }, _sum: { fileSize: true } })]);
    if ((saved._sum.fileSize || 0) + (reserved._sum.fileSize || 0) + input.fileSize > quota) throw new HttpError(413, 'Достигнут предел хранилища.');
    await tx.uploadTicket.create({ data: { id: ticketId, ownerKey: uploadOwner(req), requestId: input.requestId, pathname, fileName: path.basename(input.fileName), fileType: input.fileType, fileSize: input.fileSize, expiresAt } });
  });
  const token = await generateClientTokenFromReadWriteToken({ token: process.env.BLOB_READ_WRITE_TOKEN!, pathname, allowedContentTypes: [input.fileType], maximumSizeInBytes: input.fileSize, validUntil: expiresAt.getTime(), addRandomSuffix: false, allowOverwrite: false });
  return { id: ticketId, pathname, token };
}
export async function verifyTicket(req: Request, ticketId: string) {
  const ticket = await db.uploadTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.ownerKey !== uploadOwner(req) || ticket.usedAt || ticket.expiresAt.getTime() < Date.now()) throw new HttpError(404, 'Загрузка не найдена или истекла.');
  const result = await get(ticket.pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) throw new HttpError(400, 'Загрузка ещё не завершена.');
  const reader = result.stream.getReader(), header = Buffer.alloc(16);
  let offset = 0;
  try { while (offset < header.length) { const chunk = await reader.read(); if (chunk.done) break; const amount = Math.min(header.length - offset, chunk.value.length); header.set(chunk.value.subarray(0, amount), offset); offset += amount; } } finally { await reader.cancel(); }
  if (result.blob.size !== ticket.fileSize || result.blob.contentType !== ticket.fileType || !validHeader(header, ticket.fileType)) {
    await del(ticket.pathname);
    await db.uploadTicket.delete({ where: { id: ticket.id } });
    await audit(req, 'UPLOAD_REJECTED', undefined, 400);
    throw new HttpError(400, 'Содержимое файла не соответствует указанному типу.');
  }
  await db.uploadTicket.update({ where: { id: ticketId }, data: { verifiedAt: new Date(), fileUrl: result.blob.url } });
}
export async function consumeTickets(tx: Prisma.TransactionClient, req: Request, ids: string[], scope?: number) {
  if (!ids.length) return [];
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Повторные файлы.');
  const tickets = await tx.uploadTicket.findMany({ where: { id: { in: ids }, ownerKey: uploadOwner(req), requestId: scope ?? null, verifiedAt: { not: null }, usedAt: null, expiresAt: { gt: new Date() } } });
  if (tickets.length !== ids.length) throw new HttpError(400, 'Недопустимые или истёкшие вложения.');
  const changed = await tx.uploadTicket.updateMany({ where: { id: { in: ids }, usedAt: null }, data: { usedAt: new Date() } });
  if (changed.count !== ids.length) throw new HttpError(409, 'Вложения уже использованы.');
  return tickets.map((ticket) => ({ fileName: ticket.fileName, fileType: ticket.fileType, fileSize: ticket.fileSize, fileUrl: ticket.fileUrl! }));
}
