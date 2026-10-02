import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd(),
  runtime = path.join(root, '.runtime');
mkdirSync(runtime, { recursive: true, mode: 0o700 });
const pg =
  process.env.PG_BIN ||
  (existsSync('/Library/PostgreSQL/18/bin/initdb') ? '/Library/PostgreSQL/18/bin' : '');
const run = (cmd: string, args: string[]) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`Command failed: ${cmd}`);
};
try {
  const password = randomBytes(24).toString('hex'),
    adminPassword = randomBytes(12).toString('base64url');
  writeFileSync(
    '.env',
    `DATABASE_URL=postgresql://drivecore:${password}@127.0.0.1:55439/drivecore\nJWT_SECRET=${randomBytes(48).toString('hex')}\nSEED_ADMIN_EMAIL=admin@drivecore.local\nSEED_ADMIN_PASSWORD=${adminPassword}\nPORT=4000\nAPP_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4000,http://127.0.0.1:4000\nTZ=Europe/Moscow\nUPLOAD_DIR=backend/uploads\n`,
    { flag: 'wx', mode: 0o600 },
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
}
const dotenv = await import('dotenv');
dotenv.config();
if (!pg)
  throw new Error(
    'Install PostgreSQL or use docker compose. PG_BIN can point to existing PostgreSQL binaries.',
  );
const dbUrl = new URL(process.env.DATABASE_URL!);
const data = path.join(runtime, 'postgres');
if (!existsSync(path.join(data, 'PG_VERSION'))) {
  const secretDir = mkdtempSync(path.join(runtime, 'initdb-'));
  const pw = path.join(secretDir, 'pg-password');
  writeFileSync(pw, decodeURIComponent(dbUrl.password), { flag: 'wx', mode: 0o600 });
  try { run(path.join(pg, 'initdb'), [
    '-D',
    data,
    '-U',
    'drivecore',
    '--auth=scram-sha-256',
    `--pwfile=${pw}`,
    '--encoding=UTF8',
    '--locale=C',
  ]); } finally { rmSync(secretDir, { recursive: true, force: true }); }
}
const status = spawnSync(path.join(pg, 'pg_ctl'), ['-D', data, 'status']);
if (status.status !== 0)
  run(path.join(pg, 'pg_ctl'), [
    '-D',
    data,
    '-l',
    path.join(runtime, 'postgres.log'),
    '-o',
    `-p ${dbUrl.port} -h 127.0.0.1 -k /tmp`,
    'start',
  ]);
process.env.PGPASSWORD = decodeURIComponent(dbUrl.password);
const check = spawnSync(
  path.join(pg, 'psql'),
  [
    '-h',
    '127.0.0.1',
    '-p',
    dbUrl.port,
    '-U',
    'drivecore',
    '-d',
    'postgres',
    '-tAc',
    "SELECT 1 FROM pg_database WHERE datname='drivecore'",
  ],
  { encoding: 'utf8', env: process.env },
);
if (!check.stdout?.trim())
  run(path.join(pg, 'createdb'), [
    '-h',
    '127.0.0.1',
    '-p',
    dbUrl.port,
    '-U',
    'drivecore',
    'drivecore',
  ]);
console.log(
  'PostgreSQL ready. Run db:generate, db:migrate and db:seed. Administrator password is in the protected local .env only.',
);
