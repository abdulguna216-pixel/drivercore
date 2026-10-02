import { app } from './app.js';
import { db } from './utils/db.js';
const server = app.listen(Number(process.env.PORT) || 4000, process.env.HOST || '127.0.0.1', () =>
  console.log(`DRIVECORE API: http://localhost:${process.env.PORT || 4000}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
