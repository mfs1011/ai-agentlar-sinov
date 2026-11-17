import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let config;
try {
  config = loadConfig(process.env);
} catch (err) {
  console.error(`Sozlamada xato: ${err.message}`);
  process.exit(1);
}

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const server = http.createServer(createApp({ publicDir }));

server.on('error', (err) => {
  console.error(`Serverni ishga tushirib bo'lmadi: ${err.message}`);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log(`Server ishga tushdi: http://${config.host}:${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} olindi, server to'xtatilmoqda...`);
  server.close(() => process.exit(0));
  // Ochiq ulanishlar yopilmasa, majburan chiqamiz
  setTimeout(() => {
    console.error('Ulanishlar o\'z vaqtida yopilmadi, majburan chiqilmoqda');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
