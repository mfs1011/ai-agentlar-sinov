import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { split } from './installments.js';
import { validateInput } from './validate.js';

export const MAX_BODY_BYTES = 1024;

/**
 * Oq ro'yxat: URL yo'li → public/ ichidagi fayl va uning turi.
 * Faqat shu yerda sanalgan fayllar beriladi; URL hech qachon fayl yo'liga
 * aylantirilmaydi, shuning uchun `..` orqali chiqib ketish imkonsiz.
 */
const HTML = 'text/html; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';
const CSS = 'text/css; charset=utf-8';

const STATIC_FILES = new Map([
  ['/', { file: 'index.html', type: HTML }],
  ['/index.html', { file: 'index.html', type: HTML }],
  ['/app.js', { file: 'app.js', type: JS }],
  ['/lib.js', { file: 'lib.js', type: JS }],
  ['/style.css', { file: 'style.css', type: CSS }],
]);

const HTML_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

const MESSAGES = {
  VALIDATION_ERROR: 'Kiritilgan ma\'lumotlar noto\'g\'ri',
  INVALID_JSON: 'So\'rov tanasi yaroqli JSON emas',
  UNSUPPORTED_MEDIA_TYPE: 'Content-Type application/json bo\'lishi kerak',
  PAYLOAD_TOO_LARGE: `So'rov tanasi juda katta (ko'pi bilan ${MAX_BODY_BYTES} bayt)`,
  NOT_FOUND: 'So\'ralgan manzil topilmadi',
  METHOD_NOT_ALLOWED: 'Bu manzil uchun so\'rov metodi noto\'g\'ri',
  INTERNAL_ERROR: 'Serverda ichki xato yuz berdi',
};

class HttpError extends Error {
  constructor(status, code, { details = [], headers = {} } = {}) {
    super(MESSAGES[code]);
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

function send(req, res, status, headers, body = '') {
  res.writeHead(status, {
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function sendJson(req, res, status, data, headers = {}) {
  send(req, res, status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  }, JSON.stringify(data));
}

function sendError(req, res, err) {
  sendJson(req, res, err.status, {
    error: { code: err.code, message: err.message, details: err.details },
  }, err.headers);
}

function methodNotAllowed(allow) {
  return new HttpError(405, 'METHOD_NOT_ALLOWED', { headers: { allow } });
}

function isJsonContentType(header) {
  if (!header) return false;
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}

/** So'rov tanasini limit bilan o'qiydi. Limitdan oshsa 413. */
function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Promise.reject(new HttpError(413, 'PAYLOAD_TOO_LARGE'));
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;

    const onData = (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        req.off('data', onData);
        req.resume(); // qolganini o'qib tashlab yuborish, ulanish osilib qolmasin
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
    };

    req.on('data', onData);
    req.on('end', () => {
      if (!done) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      if (!done) reject(err);
    });
  });
}

async function handleInstallments(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed('POST');
  if (!isJsonContentType(req.headers['content-type'])) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  const raw = await readBody(req);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }

  const result = validateInput(body);
  if (!result.ok) {
    throw new HttpError(400, 'VALIDATION_ERROR', { details: result.errors });
  }

  const { amount, months } = result.value;
  const payments = split(amount, months).map((value, i) => ({ month: i + 1, amount: value }));
  sendJson(req, res, 200, { amount, months, payments });
}

function handleHealth(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw methodNotAllowed('GET, HEAD');
  sendJson(req, res, 200, { status: 'ok' });
}

async function handleStatic(req, res, entry, publicDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw methodNotAllowed('GET, HEAD');

  let content;
  try {
    content = await readFile(join(publicDir, entry.file));
  } catch (err) {
    if (err.code === 'ENOENT') throw new HttpError(404, 'NOT_FOUND');
    throw err;
  }

  const headers = { 'content-type': entry.type, 'cache-control': 'no-cache' };
  if (entry.type === HTML) headers['content-security-policy'] = HTML_CSP;
  send(req, res, 200, headers, content);
}

/**
 * HTTP so'rovlar uchun handler yaratadi.
 * @param {{publicDir: string}} options  statik fayllar papkasi
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createApp({ publicDir }) {
  return async (req, res) => {
    try {
      // Yo'lni normallashtirmasdan olamiz: `/../x` yoki `/%2e%2e/x` kabi so'rovlar
      // oq ro'yxatdagi kalitlarga hech qachon mos kelmaydi → 404.
      const pathname = req.url.split('?')[0];

      if (pathname === '/api/installments') return await handleInstallments(req, res);
      if (pathname === '/healthz') return handleHealth(req, res);

      const entry = STATIC_FILES.get(pathname);
      if (entry) return await handleStatic(req, res, entry, publicDir);

      throw new HttpError(404, 'NOT_FOUND');
    } catch (err) {
      if (!(err instanceof HttpError)) {
        console.error('Kutilmagan xato:', err);
        err = new HttpError(500, 'INTERNAL_ERROR');
      }
      if (res.headersSent) {
        res.destroy();
        return;
      }
      // 413 da mijoz hali ma'lumot yuborayotgan bo'lishi mumkin — ulanishni yopamiz
      if (err.status === 413) err.headers = { ...err.headers, connection: 'close' };
      sendError(req, res, err);
    }
  };
}
