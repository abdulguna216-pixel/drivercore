import 'dotenv/config';
const url = new URL(process.env.DATABASE_URL!);
url.pathname = '/drivecore_test';
process.env.DATABASE_URL = url.toString();
process.env.PORT = '4001';
process.env.UPLOAD_DIR = '.runtime/test-uploads';
process.env.APP_ORIGIN = 'http://localhost:5174,http://127.0.0.1:5174';
await import('../backend/src/server.js');
