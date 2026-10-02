import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const source = await readFile('.env', 'utf8'), values = parse(source);
const url = new URL(values.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '55439' || url.pathname !== '/drivecore') throw new Error('Rotation only supports this dedicated local DRIVECORE database.');
const db = new PrismaClient({ datasources: { db: { url: values.DATABASE_URL } } });
const databasePassword = randomBytes(24).toString('hex'), adminPassword = randomBytes(24).toString('base64url');
url.password = databasePassword;
values.DATABASE_URL = url.toString(); values.JWT_SECRET = randomBytes(48).toString('hex'); values.SEED_ADMIN_PASSWORD = adminPassword;
await writeFile('.env.rotation', Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
try {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const passwords = await Promise.all(users.map(async (user) => ({ id: user.id, hash: await bcrypt.hash(user.email === values.SEED_ADMIN_EMAIL ? adminPassword : randomBytes(24).toString('base64url'), 12) })));
  await db.$transaction(async (tx) => {
    for (const user of passwords) await tx.user.update({ where: { id: user.id }, data: { passwordHash: user.hash, sessionVersion: { increment: 1 } } });
    await tx.session.deleteMany();
    // SQL is constructed by PostgreSQL format(%I/%L) from current_user and cryptographically generated data, never from an HTTP input.
    const [{ statement }] = await tx.$queryRaw<{ statement: string }[]>`SELECT format('ALTER ROLE %I PASSWORD %L', current_user, ${databasePassword}::text) AS statement`;
    await tx.$executeRawUnsafe(statement);
  }, { timeout: 10000 });
  await rename('.env.rotation', '.env');
  for (const file of ['.runtime/DEMO_ACCESS.txt', '.runtime/staff-access.json', '.runtime/pg-password']) await unlink(file).catch(() => undefined);
  console.log('Local secrets rotated; all sessions revoked. Administrator password is only in the protected .env. Other staff passwords can be reset in CRM.');
} finally { await db.$disconnect(); }
