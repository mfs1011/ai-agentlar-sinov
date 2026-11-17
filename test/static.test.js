// Haqiqiy public/ papkasi bilan: oq ro'yxat va fayllar bir-biriga mosligini tekshiradi.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const EXPECTED = [
  ['/', 'index.html', 'text/html; charset=utf-8'],
  ['/index.html', 'index.html', 'text/html; charset=utf-8'],
  ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
  ['/lib.js', 'lib.js', 'text/javascript; charset=utf-8'],
  ['/style.css', 'style.css', 'text/css; charset=utf-8'],
];

let server;
let baseUrl;

before(async () => {
  server = http.createServer(createApp({ publicDir: PUBLIC_DIR }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
});

describe('public/ fayllari oq ro\'yxat orqali', () => {
  for (const [path, file, type] of EXPECTED) {
    it(`GET ${path} → ${file} (${type})`, async () => {
      const res = await fetch(baseUrl + path);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), type);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(await res.text(), await readFile(join(PUBLIC_DIR, file), 'utf8'));
    });
  }

  it('public/ dagi har bir fayl oq ro\'yxatda (unutilgan fayl yo\'q)', async () => {
    const onDisk = (await readdir(PUBLIC_DIR)).filter((f) => !f.startsWith('.')).sort();
    const listed = [...new Set(EXPECTED.map(([, file]) => file))].sort();
    assert.deepEqual(onDisk, listed);
  });

  it('CSS va JS ga CSP qo\'yilmaydi, HTML ga qo\'yiladi', async () => {
    assert.equal((await fetch(baseUrl + '/style.css')).headers.get('content-security-policy'), null);
    assert.match((await fetch(baseUrl + '/')).headers.get('content-security-policy'), /default-src 'self'/);
  });
});

describe('index.html tuzilishi', () => {
  let html;
  before(async () => {
    html = await readFile(join(PUBLIC_DIR, 'index.html'), 'utf8');
  });

  it('havolalar (src/href) faqat serverda bor fayllarga', async () => {
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(refs.length >= 2, 'kamida CSS va JS havolasi bo\'lishi kerak');
    for (const ref of refs) {
      const res = await fetch(new URL(ref, baseUrl + '/'));
      assert.equal(res.status, 200, `${ref} → ${res.status}`);
    }
  });

  it('CSP bilan mos: inline skript, inline stil va on* atributlari yo\'q', () => {
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, 'inline <script>');
    assert.doesNotMatch(html, /<style\b/i, '<style>');
    assert.doesNotMatch(html, /\sstyle="/i, 'style="..."');
    assert.doesNotMatch(html, /\son[a-z]+="/i, 'onclick="..." va h.k.');
  });

  it('mobil: viewport meta, lang="uz"', () => {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<html lang="uz">/);
  });

  it('forma: amount va months maydonlari, har birida xato joyi bog\'langan', () => {
    for (const field of ['amount', 'months']) {
      assert.match(html, new RegExp(`<input[^>]*\\bname="${field}"`), `${field} input`);
      assert.match(html, new RegExp(`<label[^>]*\\bfor="${field}"`), `${field} label`);
      assert.match(html, new RegExp(`aria-describedby="[^"]*${field}-error`), `${field} aria-describedby`);
      assert.match(html, new RegExp(`id="${field}-error"`), `${field}-error elementi`);
    }
  });

  it('natija jadvali: thead, tbody, tfoot (Jami)', () => {
    assert.match(html, /<table[\s\S]*<thead[\s\S]*<tbody[\s\S]*<tfoot[\s\S]*Jami[\s\S]*<\/table>/);
  });
});
