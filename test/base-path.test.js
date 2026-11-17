// Frontend prefiks ostida (Nginx: /kalkulyator/ → 127.0.0.1:3100/) ham, ildizda ham
// ishlashini tekshiradi. Buning uchun:
//  1) public/ dagi barcha havolalar nisbiy ekanini statik tekshiramiz;
//  2) Nginx'ni taqlid qiluvchi kichik proksi orqali sahifa ochilganda brauzer
//     so'raydigan har bir URL'ni (CSS, JS, import, fetch) haqiqatan so'rab ko'ramiz.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const PREFIX = '/kalkulyator/';

const read = (file) => readFile(join(PUBLIC_DIR, file), 'utf8');

/** HTML dagi src/href qiymatlari */
const htmlRefs = (html) => [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);

/** JS dagi statik/dinamik importlar va fetch() ning birinchi argumenti (satr literal) */
function jsRefs(js) {
  const imports = [...js.matchAll(/\bimport\s*(?:[^'"()]*?\bfrom\s*)?\(?\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
  const fetches = [...js.matchAll(/\bfetch\(\s*(['"`])([^'"`]+)\1/g)].map((m) => m[2]);
  return { imports, fetches };
}

/** CSS dagi url(...) va @import */
const cssRefs = (css) => [...css.matchAll(/url\(\s*['"]?([^'")]+)|@import\s+['"]([^'"]+)/g)].map((m) => m[1] ?? m[2]);

function assertRelative(ref, where) {
  assert.ok(!ref.startsWith('/'), `${where}: "${ref}" absolyut yo'l — prefiks ostida buziladi`);
  assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(ref), `${where}: "${ref}" to'liq URL — nisbiy bo'lishi kerak`);
}

describe('public/ dagi havolalar nisbiy', () => {
  it('index.html: src/href', async () => {
    const refs = htmlRefs(await read('index.html'));
    assert.ok(refs.length >= 2);
    for (const ref of refs) assertRelative(ref, 'index.html');
  });

  for (const file of ['app.js', 'lib.js']) {
    it(`${file}: import va fetch`, async () => {
      const { imports, fetches } = jsRefs(await read(file));
      for (const ref of [...imports, ...fetches]) assertRelative(ref, file);
    });
  }

  it('app.js API ni fetch() bilan chaqiradi (regex haqiqatan topadi)', async () => {
    const { imports, fetches } = jsRefs(await read('app.js'));
    assert.deepEqual(fetches, ['api/installments']);
    assert.ok(imports.includes('./lib.js'));
  });

  it('style.css: url() va @import', async () => {
    for (const ref of cssRefs(await read('style.css'))) assertRelative(ref, 'style.css');
  });
});

// --- Nginx taqlidi ---------------------------------------------------------

let app;
let proxy;
let proxyUrl;

/**
 * `location ^~ /kalkulyator/ { proxy_pass http://127.0.0.1:PORT/; }` kabi:
 * prefiksni olib tashlab ilovaga uzatadi. Prefiksdan tashqaridagi yo'llar — domendagi
 * "boshqa sayt" (Nginx 404 HTML). Shuning uchun absolyut yo'l prefiksdan "qochib
 * ketsa", test 404 ni ko'radi.
 */
function createProxy(target) {
  return http.createServer((req, res) => {
    if (!req.url.startsWith(PREFIX)) {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<html><body>nginx 404</body></html>');
      return;
    }
    const path = '/' + req.url.slice(PREFIX.length);
    const upstream = http.request(
      { host: '127.0.0.1', port: target, method: req.method, path, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
}

before(async () => {
  app = http.createServer(createApp({ publicDir: PUBLIC_DIR }));
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');

  proxy = createProxy(app.address().port);
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  proxyUrl = `http://127.0.0.1:${proxy.address().port}`;
});

after(async () => {
  for (const s of [proxy, app]) {
    s.close();
    await once(s, 'close');
  }
});

/** Brauzer sahifani ochganda qiladigan so'rovlarni takrorlaydi. */
async function simulatePageLoad(pageUrl) {
  const page = await fetch(pageUrl);
  assert.equal(page.status, 200, `${pageUrl} → ${page.status}`);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  const html = await page.text();

  const scripts = [];
  for (const ref of htmlRefs(html)) {
    const url = new URL(ref, pageUrl);
    const res = await fetch(url);
    assert.equal(res.status, 200, `${ref} → ${url.pathname} → ${res.status}`);
    if (res.headers.get('content-type').startsWith('text/javascript')) {
      scripts.push({ url, js: await res.text() });
    } else {
      await res.arrayBuffer();
    }
  }
  assert.ok(scripts.length >= 1, 'sahifada kamida bitta skript bo\'lishi kerak');

  for (const { url: scriptUrl, js } of scripts) {
    const { imports, fetches } = jsRefs(js);
    // Modul importlari skript URL'iga nisbatan hal qilinadi
    for (const ref of imports) {
      const url = new URL(ref, scriptUrl);
      const res = await fetch(url);
      assert.equal(res.status, 200, `import ${ref} → ${url.pathname} → ${res.status}`);
      await res.arrayBuffer();
    }
    // fetch() esa hujjat (sahifa) URL'iga nisbatan
    for (const ref of fetches) {
      const url = new URL(ref, pageUrl);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 1000, months: 3 }),
      });
      assert.equal(res.status, 200, `fetch ${ref} → ${url.pathname} → ${res.status}`);
      const data = await res.json();
      assert.deepEqual(data.payments.map((p) => p.amount), [334, 333, 333]);
    }
  }
}

describe('sahifa Nginx prefiksi ostida ishlaydi', () => {
  it('/kalkulyator/ — barcha resurslar va API prefiks ichida', async () => {
    await simulatePageLoad(`${proxyUrl}/kalkulyator/`);
  });

  it('/kalkulyator/index.html — ham ishlaydi', async () => {
    await simulatePageLoad(`${proxyUrl}/kalkulyator/index.html`);
  });

  it('proksi taqlidi absolyut yo\'lni haqiqatan ushlaydi (o\'z-o\'zini tekshirish)', async () => {
    assert.equal((await fetch(`${proxyUrl}/app.js`)).status, 404);
    assert.equal((await fetch(`${proxyUrl}/kalkulyator/app.js`)).status, 200);
  });
});

describe('sahifa ildizda (prefikssiz) ishlaydi', () => {
  it('/ — to\'g\'ridan-to\'g\'ri ilovaga', async () => {
    await simulatePageLoad(`http://127.0.0.1:${app.address().port}/`);
  });
});
