import multer from 'multer';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { open, unlink, readdir, stat, statfs } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { HttpError, asyncRoute } from '../utils/errors.js';
import { db } from '../utils/db.js';
import { audit } from './security.js';
export const uploadDir = path.resolve(process.env.UPLOAD_DIR || (process.env.VERCEL ? '/tmp/drivecore-uploads' : 'backend/uploads'));
mkdirSync(uploadDir, { recursive: true });
declare global { namespace Express { interface Request { uploadReservation?: string; } } }
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const fileTypes = [...imageTypes, 'application/pdf', 'video/mp4', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const makeUpload = (publicUpload: boolean) => multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: (publicUpload ? 5 : 20) * 1024 * 1024, files: 5, fields: 16, parts: 21, fieldSize: 8192, fieldNameSize: 64, fieldNestingDepth: 0, fieldArrayIndexLimit: 0 } as multer.Options['limits'],
  fileFilter: (_req, file, cb) => {
    const allowed = publicUpload ? imageTypes : fileTypes;
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Допустимы JPG, PNG, WebP, MP4, PDF и DOCX.'));
  },
}).array('files', 5);
const publicParser = makeUpload(true), staffParser = makeUpload(false);
export async function releaseUpload(req: Request) {
  if (req.uploadReservation) { await db.rateBucket.deleteMany({ where: { key: req.uploadReservation } }); req.uploadReservation = undefined; }
}
export const upload: RequestHandler = asyncRoute(async (req, res, next) => {
  if (!req.is('multipart/form-data')) { next(); return; }
  if (process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(400, 'Используйте прямую загрузку в приватное хранилище.');
  const bytes = Number(req.get('content-length'));
  const maximum = (req.user ? 101 : 26) * 1024 * 1024;
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new HttpError(411, 'Загрузка требует Content-Length.');
  if (bytes > maximum) throw new HttpError(413, 'Превышен суммарный размер загрузки.');
  const quota = Number(process.env.UPLOAD_MAX_BYTES || 1024 * 1024 * 1024);
  const disk = await statfs(uploadDir);
  const names = await readdir(uploadDir);
  const sizes = await Promise.all(names.map(async (name) => { const item = await stat(path.join(uploadDir, name)); return item.isFile() ? item.size : 0; }));
  const existingBytes = sizes.reduce((a, b) => a + b, 0);
  if (disk.bavail * disk.bsize < bytes + 100 * 1024 * 1024 || existingBytes + bytes > quota) {
    await audit(req, 'STORAGE_LIMIT', undefined, 413);
    throw new HttpError(413, 'Недостаточно места для загрузки.');
  }
  const reservation = `upload-reservation:${randomUUID()}`;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(716002)`;
    const [saved, pending] = await Promise.all([tx.file.aggregate({ _sum: { fileSize: true } }), tx.rateBucket.aggregate({ where: { key: { startsWith: 'upload-reservation:' }, expiresAt: { gt: new Date() } }, _sum: { count: true } })]);
    if (Math.max(saved._sum.fileSize || 0, existingBytes) + (pending._sum.count || 0) + bytes > quota) throw new HttpError(413, 'Достигнут предел хранилища.');
    await tx.rateBucket.create({ data: { key: reservation, count: bytes, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  });
  req.uploadReservation = reservation;
  (req.user ? staffParser : publicParser)(req, res, (error) => {
    if (error) { void releaseUpload(req).then(() => next(error), next); }
    else next();
  });
});
export async function verifyFiles(files: Express.Multer.File[], publicUpload = false) {
  for (const file of files) {
    const handle = await open(file.path, 'r');
    const buffer = Buffer.alloc(16);
    try { await handle.read(buffer, 0, buffer.length, 0); } finally { await handle.close(); }
    const mime = file.mimetype;
    const valid = validHeader(buffer, mime);
    if (!valid || (publicUpload && (!mime.startsWith('image/') || file.size > 5 * 1024 * 1024)))
      throw new HttpError(
        400,
        publicUpload
          ? 'Прикрепите фотографии JPG, PNG или WebP до 5 МБ.'
          : 'Содержимое файла не соответствует его типу.',
      );
  }
}
export function validHeader(buffer: Buffer, mime: string) {
    return (
      mime === 'image/jpeg'
        ? buffer[0] === 255 && buffer[1] === 216
        : mime === 'image/png'
          ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : mime === 'image/webp'
            ? buffer.toString('ascii', 0, 4) === 'RIFF' &&
              buffer.toString('ascii', 8, 12) === 'WEBP'
            : mime === 'application/pdf'
              ? buffer.toString('ascii', 0, 5) === '%PDF-'
              : mime === 'video/mp4'
                ? buffer.toString('ascii', 4, 8) === 'ftyp'
                : mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && buffer.toString('ascii', 0, 2) === 'PK'
    );
}
export const cleanup = (files: Express.Multer.File[]) =>
  Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
export const metadata = (file: Express.Multer.File) => ({
  fileName: path.basename(file.originalname).slice(0, 200),
  fileUrl: path.basename(file.path),
  fileType: file.mimetype,
  fileSize: file.size,
});
