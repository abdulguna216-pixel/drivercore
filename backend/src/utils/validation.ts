import { z } from 'zod';
import { normalizePhone } from '../../../shared/phone.js';
export const text = (max = 200) =>
  z
    .string()
    .trim()
    .min(1, 'Заполните поле')
    .max(max, 'Слишком длинное значение')
    .refine(
      (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value),
      'Недопустимые символы',
    );
export const phone = z
  .string()
  .max(50)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Введите полный номер: +7 (___) ___-__-__ — 10 цифр после +7' });
      return z.NEVER;
    }
    return normalized;
  });
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
export const money = z.coerce
  .number()
  .finite()
  .min(0)
  .max(1e8)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    'Не более двух знаков после запятой',
  );
export const id = z.coerce.number().int().positive();
export const date = z
  .string()
  .refine(
    (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    'Некорректная дата',
  );
export const datetime = z.string().datetime({ offset: true }).refine((value) => {
  const offset = value.match(/([+-])(\d{2}):?(\d{2})$/);
  return !Number.isNaN(Date.parse(value)) && (!offset || (Number(offset[2]) <= 14 && Number(offset[3]) < 60 && (Number(offset[2]) < 14 || Number(offset[3]) === 0)));
}, 'Некорректная дата или часовой пояс');
export const password = z.string().min(12, 'Минимум 12 символов').max(72).refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'Пароль должен занимать не более 72 байт UTF-8',
);
export const createRequestSchema = z
  .object({
    name: text(100),
    phone,
    carBrand: text(80),
    carModel: text(80),
    year: z.coerce
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .optional(),
    licensePlate: optionalText(20),
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN должен содержать 17 символов')
      .optional(),
    mileage: z.coerce.number().int().min(0).max(3000000).optional(),
    serviceId: text(100).optional(),
    service: text(150).optional(),
    preferredDate: date.optional(),
    comment: z.string().trim().max(4000).default(''),
    source: z.enum(['website', 'phone', 'telegram', 'manual']).optional(),
  })
  .refine((data) => !!(data.serviceId || data.service), {
    path: ['serviceId'],
    message: 'Выберите услугу',
  });
export const appointmentSchema = z
  .object({
    requestId: id,
    mechanicId: text(100),
    startsAt: datetime,
    endsAt: datetime,
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), 'Окончание должно быть позже начала')
  .refine(
    (v) => Date.parse(v.endsAt) - Date.parse(v.startsAt) <= 24 * 60 * 60 * 1000,
    'Продолжительность не более 24 часов',
  );
export function pagination(query: Record<string, unknown>) {
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page)) || 1)),
    limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit)) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
