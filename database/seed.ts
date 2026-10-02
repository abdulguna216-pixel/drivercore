import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
const db = new PrismaClient();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 12 || Buffer.byteLength(adminPassword, 'utf8') > 72)
  throw new Error('Set SEED_ADMIN_PASSWORD (12 characters, at most 72 UTF-8 bytes).');
const staff = [
  {
    name: 'Администратор',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@drivecore.local',
    role: 'ADMIN' as const,
  },
  {
    name: 'Менеджер 1',
    email: 'manager1@drivecore.local',
    role: 'MANAGER' as const,
  },
  {
    name: 'Менеджер 2',
    email: 'manager2@drivecore.local',
    role: 'MANAGER' as const,
  },
  {
    name: 'Мастер 1',
    email: 'mechanic1@drivecore.local',
    role: 'MECHANIC' as const,
  },
  {
    name: 'Мастер 2',
    email: 'mechanic2@drivecore.local',
    role: 'MECHANIC' as const,
  },
  {
    name: 'Мастер 3',
    email: 'mechanic3@drivecore.local',
    role: 'MECHANIC' as const,
  },
];
// These role labels and .local accounts are synthetic bootstrap fixtures, not personnel data.
// Existing databases retain their users; bootstrap staff are created only in an empty database.
if (await db.user.count() === 0) for (const user of staff) {
  const password = user.role === 'ADMIN' ? adminPassword : randomBytes(15).toString('base64url');
  await db.user.create({
    data: { ...user, passwordHash: await bcrypt.hash(password, 12) },
  });
}
const services = [
  ['Компьютерная диагностика', 'Проверка электронных систем автомобиля и поиск ошибок.', 1500, 60],
  [
    'Техническое обслуживание',
    'Замена масла, фильтров, технических жидкостей и расходников.',
    3000,
    90,
  ],
  ['Ремонт подвески', 'Диагностика и ремонт элементов подвески автомобиля.', 2500, 120],
  [
    'Тормозная система',
    'Диагностика, обслуживание и замена элементов тормозной системы.',
    2000,
    90,
  ],
  ['Автоэлектрика', 'Диагностика и ремонт электрических систем автомобиля.', 2500, 120],
  ['Шиномонтаж', 'Замена, балансировка и ремонт автомобильных шин.', 1800, 60],
] as const;
for (const [name, description, price, duration] of services)
  await db.service.upsert({
    where: { name },
    create: { name, description, price, duration },
    update: {},
  });
await db.setting.upsert({
  where: { id: 'main' },
  create: { id: 'main' },
  update: {},
});
console.log(
  'Seed ready: 1 administrator, 2 managers, 3 mechanics, 6 services. No demo requests or revenue.',
);
await db.$disconnect();
