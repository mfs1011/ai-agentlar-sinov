const DEFAULT_HOST = '127.0.0.1';

/**
 * PORT qiymatini qat'iy tekshiradi: faqat o'nlik raqamlar, 1–65535.
 * @param {string | undefined} raw
 * @returns {number}
 */
export function parsePort(raw) {
  if (raw === undefined || raw === '') {
    throw new Error('PORT muhit o\'zgaruvchisi berilmagan (masalan, PORT=3000)');
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`PORT butun son bo'lishi kerak, berilgan: ${JSON.stringify(raw)}`);
  }
  const port = Number(raw);
  if (port < 1 || port > 65535) {
    throw new Error(`PORT 1 dan 65535 gacha bo'lishi kerak, berilgan: ${raw}`);
  }
  return port;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{port: number, host: string}}
 */
export function loadConfig(env = process.env) {
  return {
    port: parsePort(env.PORT),
    host: env.HOST || DEFAULT_HOST,
  };
}
