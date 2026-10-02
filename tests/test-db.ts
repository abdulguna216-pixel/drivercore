import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcrypt';
export async function prepareTestDb() {
  process.env.NODE_ENV = 'test';
  const mainUrl = process.env.DATABASE_URL!;
  const url = new URL(mainUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Tests require local PostgreSQL; remote databases cannot be reset.');
  process.env.SEED_ADMIN_EMAIL = 'admin@example.test';
  process.env.SEED_ADMIN_PASSWORD = 'test-only-admin-password-2026';
  process.env.JWT_SECRET = 'test-only-session-secret-not-for-deployment-2026';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  url.pathname = '/drivecore_test';
  const testUrl = url.toString();
  const maintenance = new PrismaClient({
    datasources: { db: { url: mainUrl } },
  });
  if (
    !(
      await maintenance.$queryRaw<
        { exists: boolean }[]
      >`SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='drivecore_test') AS exists`
    )[0].exists
  )
    await maintenance.$executeRawUnsafe('CREATE DATABASE drivecore_test');
  await maintenance.$disconnect();
  process.env.DATABASE_URL = testUrl;
  process.env.UPLOAD_DIR = path.resolve('.runtime/test-uploads');
  mkdirSync(process.env.UPLOAD_DIR, { recursive: true });
  process.env.TEST_STAFF_PASSWORD = 'test-only-staff-password-2026';
  const run = (args: string[]) => {
    const result = spawnSync(process.execPath, args, {
      env: process.env,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  };
  run([
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'database/prisma/schema.prisma',
  ]);
  const testClient = new PrismaClient({
    datasources: { db: { url: testUrl } },
  });
  await testClient.$executeRawUnsafe(
    'TRUNCATE "User", "Client", "Car", "Service", "Request", "Appointment", "Task", "Comment", "File", "WorkOrder", "WorkOrderItem", "Payment", "ActivityLog", "Notification", "Setting", "Session", "SecurityEvent", "SecurityAlert", "RateBucket", "UploadTicket" RESTART IDENTITY CASCADE',
  );
  await testClient.$disconnect();
  run(['--import', 'tsx', 'database/seed.ts']);
  const fixtures = new PrismaClient({ datasources: { db: { url: testUrl } } });
  await fixtures.user.updateMany({ where: { role: { not: 'ADMIN' } }, data: { passwordHash: await bcrypt.hash(process.env.TEST_STAFF_PASSWORD, 12) } });
  await fixtures.$disconnect();
  return testUrl;
}
