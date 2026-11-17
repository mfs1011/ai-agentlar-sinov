import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

const INDEX_HTML = '<!doctype html><title>Test sahifa</title>';

let server;
let baseUrl;
let publicDir;
let emptyPublicDir;
let emptyServer;
let emptyBaseUrl;

async function startServer(dir) {
  const srv = http.createServer(createApp({ publicDir: dir }));
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  return [srv, `http://127.0.0.1:${srv.address().port}`];
}

before(async () => {
  publicDir = await mkdtemp(join(tmpdir(), 'kalk-public-'));
  emptyPublicDir = await mkdtemp(join(tmpdir(), 'kalk-empty-'));
  await writeFile(join(publicDir, 'index.html'), INDEX_HTML);
  // public/ ichida bo'lsa ham oq ro'yxatda yo'q fayl berilmasligi kerak
  await writeFile(join(publicDir, 'secret.txt'), 'maxfiy');
  [server, baseUrl] = await startServer(publicDir);
  [emptyServer, emptyBaseUrl] = await startServer(emptyPublicDir);
});

after(async () => {
  server.close();
  emptyServer.close();
  await Promise.all([once(server, 'close'), once(emptyServer, 'close')]);
  await rm(publicDir, { recursive: true, force: true });
  await rm(emptyPublicDir, { recursive: true, force: true });
});

function post(body, { contentType = 'application/json', path = '/api/installments' } = {}) {
  const headers = {};
  if (contentType !== null) headers['content-type'] = contentType;
  return fetch(baseUrl + path, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Xato javobi formatini tekshiradi va JSON'ni qaytaradi. */
async function expectError(res, status, code) {
  assert.equal(res.status, status);
  assert.match(res.headers.get('content-type'), /^application\/json; charset=utf-8$/);
  const json = await res.json();
  assert.equal(json.error.code, code);
  assert.equal(typeof json.error.message, 'string');
  assert.ok(json.error.message.length > 0);
  assert.ok(Array.isArray(json.error.details));
  return json;
}

/** Fetch qayta yozolmaydigan xom HTTP so'rov (yo'l normallashtirilmasin). */
function rawRequest({ method = 'GET', path, headers = {}, chunks = [] }) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const parts = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts).toString() }));
    });
    req.on('error', reject);
    for (const c of chunks) req.write(c);
    req.end();
  });
}

describe('POST /api/installments: muvaffaqiyat', () => {
  it('1000 / 3 → 200 va to\'g\'ri format', async () => {
    const res = await post({ amount: 1000, months: 3 });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(await res.json(), {
      amount: 1000,
      months: 3,
      payments: [
        { month: 1, amount: 334 },
        { month: 2, amount: 333 },
        { month: 3, amount: 333 },
      ],
    });
  });

  it('chegaraviy: 10^15 / 120 → 120 ta to\'lov, yig\'indi aniq', async () => {
    const res = await post({ amount: 10 ** 15, months: 120 });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.payments.length, 120);
    assert.equal(json.payments.reduce((s, p) => s + p.amount, 0), 10 ** 15);
    assert.equal(json.payments[119].month, 120);
  });

  it('Content-Type parametr bilan (charset) va katta harflarda qabul qilinadi', async () => {
    const res = await post({ amount: 10, months: 2 }, { contentType: 'Application/JSON; charset=UTF-8' });
    assert.equal(res.status, 200);
  });
});

describe('POST /api/installments: xatolar', () => {
  it('validatsiya xatosi → 400 VALIDATION_ERROR + details', async () => {
    const res = await post({ amount: '1000', months: 121 });
    const json = await expectError(res, 400, 'VALIDATION_ERROR');
    assert.deepEqual(json.error.details.map((d) => d.field).sort(), ['amount', 'months']);
  });

  it('summa < oylar → 400', async () => {
    const json = await expectError(await post({ amount: 2, months: 3 }), 400, 'VALIDATION_ERROR');
    assert.equal(json.error.details[0].field, 'amount');
  });

  it('yaroqsiz JSON → 400 INVALID_JSON', async () => {
    await expectError(await post('{"amount": 1000,'), 400, 'INVALID_JSON');
  });

  it('bo\'sh tana → 400 INVALID_JSON', async () => {
    await expectError(await post(''), 400, 'INVALID_JSON');
  });

  it('massiv tana → 400 VALIDATION_ERROR (field body)', async () => {
    const json = await expectError(await post([1000, 3]), 400, 'VALIDATION_ERROR');
    assert.equal(json.error.details[0].field, 'body');
  });

  it('null tana → 400 VALIDATION_ERROR', async () => {
    await expectError(await post('null'), 400, 'VALIDATION_ERROR');
  });

  it('Content-Type yo\'q → 415', async () => {
    const res = await rawRequest({
      method: 'POST',
      path: '/api/installments',
      chunks: ['{"amount":1000,"months":3}'],
    });
    assert.equal(res.status, 415);
    assert.equal(JSON.parse(res.body).error.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('Content-Type text/plain → 415', async () => {
    await expectError(await post({ amount: 1000, months: 3 }, { contentType: 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('application/jsonx kabi o\'xshash tur → 415', async () => {
    await expectError(await post({ amount: 1000, months: 3 }, { contentType: 'application/jsonx' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('2 KB tana (Content-Length bilan) → 413', async () => {
    const body = JSON.stringify({ amount: 1000, months: 3, pad: 'x'.repeat(2048) });
    await expectError(await post(body), 413, 'PAYLOAD_TOO_LARGE');
  });

  it('2 KB tana (chunked, Content-Length yo\'q) → 413', async () => {
    const res = await rawRequest({
      method: 'POST',
      path: '/api/installments',
      headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
      chunks: ['{"pad":"', 'x'.repeat(700), 'x'.repeat(700), 'x'.repeat(700), '"}'],
    });
    assert.equal(res.status, 413);
    assert.equal(JSON.parse(res.body).error.code, 'PAYLOAD_TOO_LARGE');
  });

  it('aynan 1 KB gacha tana qabul qilinadi', async () => {
    const base = JSON.stringify({ amount: 1000, months: 3, pad: '' });
    const body = JSON.stringify({ amount: 1000, months: 3, pad: 'x'.repeat(1024 - base.length) });
    assert.equal(Buffer.byteLength(body), 1024);
    assert.equal((await post(body)).status, 200);
  });

  for (const method of ['GET', 'PUT', 'DELETE']) {
    it(`${method} /api/installments → 405 + Allow: POST`, async () => {
      const res = await fetch(baseUrl + '/api/installments', { method });
      await expectError(res, 405, 'METHOD_NOT_ALLOWED');
      assert.equal(res.headers.get('allow'), 'POST');
    });
  }

  it('/api/installments/ (oxirida slash) → 404', async () => {
    await expectError(await post({ amount: 10, months: 2 }, { path: '/api/installments/' }), 404, 'NOT_FOUND');
  });

  it('query string yo\'nalishga ta\'sir qilmaydi', async () => {
    assert.equal((await post({ amount: 10, months: 2 }, { path: '/api/installments?x=1' })).status, 200);
  });
});

describe('/healthz', () => {
  it('GET → 200 {"status":"ok"}', async () => {
    const res = await fetch(baseUrl + '/healthz');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await res.json(), { status: 'ok' });
  });

  it('HEAD → 200, tanasiz', async () => {
    const res = await fetch(baseUrl + '/healthz', { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '');
  });

  it('POST → 405 + Allow', async () => {
    const res = await fetch(baseUrl + '/healthz', { method: 'POST' });
    await expectError(res, 405, 'METHOD_NOT_ALLOWED');
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
  });
});

describe('statik fayllar', () => {
  it('GET / → index.html, text/html + CSP', async () => {
    const res = await fetch(baseUrl + '/');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await res.text(), INDEX_HTML);
  });

  it('GET /index.html → o\'sha fayl', async () => {
    const res = await fetch(baseUrl + '/index.html');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), INDEX_HTML);
  });

  it('HEAD / → 200, tanasiz', async () => {
    const res = await fetch(baseUrl + '/', { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '');
  });

  it('POST / → 405', async () => {
    const res = await fetch(baseUrl + '/', { method: 'POST' });
    await expectError(res, 405, 'METHOD_NOT_ALLOWED');
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
  });

  it('public/ ichidagi, lekin oq ro\'yxatda yo\'q fayl → 404', async () => {
    await expectError(await fetch(baseUrl + '/secret.txt'), 404, 'NOT_FOUND');
  });

  for (const path of [
    '/../package.json',
    '/%2e%2e/package.json',
    '/..%2fpackage.json',
    '/%2e%2e%2fsrc%2fapp.js',
    '/public/../package.json',
    '//etc/passwd',
    '/index.html/',
    '/INDEX.HTML',
  ]) {
    it(`yo'l ${path} → 404`, async () => {
      const res = await rawRequest({ path });
      assert.equal(res.status, 404);
      assert.equal(JSON.parse(res.body).error.code, 'NOT_FOUND');
    });
  }

  it('noma\'lum yo\'l → 404 JSON', async () => {
    await expectError(await fetch(baseUrl + '/nomalum'), 404, 'NOT_FOUND');
  });

  it('index.html diskda yo\'q bo\'lsa → 404 (500 emas)', async () => {
    await expectError(await fetch(emptyBaseUrl + '/'), 404, 'NOT_FOUND');
  });
});
