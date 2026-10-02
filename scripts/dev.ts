import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'backend/src/server.ts'], {
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    stdio: 'inherit',
  }),
];
for (const child of children)
  child.on('exit', (code) => {
    for (const other of children) if (other !== child) other.kill();
    process.exitCode = code || 0;
  });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    children.forEach((child) => child.kill(signal));
  });
