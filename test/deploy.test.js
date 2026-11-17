// deploy/ fayllari bir-biriga va ilovaga mosligini tekshiradi (serverga ulanmasdan).
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

const DEPLOY_DIR = fileURLToPath(new URL('../deploy', import.meta.url));

/** systemd unit'ni { kalit: [qiymatlar] } ko'rinishiga keltiradi (izohlarsiz). */
function parseUnit(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Za-z]+)=(.*)$/);
    if (!m) continue;
    if (!out.has(m[1])) out.set(m[1], []);
    out.get(m[1]).push(m[2].trim());
  }
  return out;
}

let unit;
let unitText;
let nginx;

before(async () => {
  unitText = await readFile(join(DEPLOY_DIR, 'kalkulyator.service'), 'utf8');
  unit = parseUnit(unitText);
  nginx = (await readFile(join(DEPLOY_DIR, 'nginx-kalkulyator.conf'), 'utf8'))
    .split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
});

const one = (key) => {
  const v = unit.get(key);
  assert.ok(v, `${key} unit'da yo'q`);
  return v.at(-1);
};

describe('systemd unit', () => {
  it('alohida foydalanuvchi, /opt/kalkulyator, /usr/local/bin/node', () => {
    assert.equal(one('User'), 'kalkulyator');
    assert.equal(one('Group'), 'kalkulyator');
    assert.equal(one('WorkingDirectory'), '/opt/kalkulyator');
    assert.equal(one('ExecStart'), '/usr/local/bin/node /opt/kalkulyator/src/server.js');
  });

  it('Environment: PORT/HOST ilovaning loadConfig() dan o\'tadi, faqat 127.0.0.1', () => {
    const env = Object.fromEntries(unit.get('Environment').map((e) => e.split('=')));
    const config = loadConfig(env);
    assert.deepEqual(config, { port: 3100, host: '127.0.0.1' });
  });

  it('xavfsizlik cheklovlari', () => {
    const expected = {
      NoNewPrivileges: 'yes',
      ProtectSystem: 'strict',
      ProtectHome: 'yes',
      PrivateTmp: 'yes',
      PrivateDevices: 'yes',
      CapabilityBoundingSet: '',
      RestrictSUIDSGID: 'yes',
      ProtectKernelTunables: 'yes',
      ProtectKernelModules: 'yes',
      ProtectControlGroups: 'yes',
      RestrictNamespaces: 'yes',
      IPAddressDeny: 'any',
      IPAddressAllow: 'localhost',
    };
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(one(key), value, key);
    }
    // ProtectSystem=strict bo'lgani uchun yozish ruxsatlari bo'lmasligi kerak — ilova yozmaydi
    assert.equal(unit.get('ReadWritePaths'), undefined);
  });

  it('Node bilan mos kelmaydigan direktivalar yoqilmagan', () => {
    // V8 JIT W+X xotira talab qiladi
    assert.equal(unit.get('MemoryDenyWriteExecute'), undefined);
  });

  it('to\'xtash vaqti ilovaning 10 s lik ichki taymeridan katta', () => {
    assert.ok(parseInt(one('TimeoutStopSec'), 10) > 10);
  });
});

describe('Nginx parchasi', () => {
  it('prefiks olib tashlanadi va unit\'dagi portga uzatiladi', () => {
    const port = loadConfig(Object.fromEntries(unit.get('Environment').map((e) => e.split('=')))).port;
    assert.match(nginx, /location \^~ \/kalkulyator\/ \{/);
    // proxy_pass oxiridagi "/" — prefiksni olib tashlaydi
    assert.match(nginx, new RegExp(`proxy_pass http://127\\.0\\.0\\.1:${port}/;`));
  });

  it('/kalkulyator ("/" siz) → 301 /kalkulyator/ (aks holda nisbiy yo\'llar ildizga ketadi)', () => {
    assert.match(nginx, /location = \/kalkulyator \{\s*return 301 \/kalkulyator\/;\s*\}/);
  });
});

describe('deploy/ fayllarida haqiqiy domen yoki IP yo\'q', () => {
  it('faqat 127.0.0.1 (0.0.0.0) va <domen> joy egasi', async () => {
    for (const file of await readdir(DEPLOY_DIR)) {
      const text = await readFile(join(DEPLOY_DIR, file), 'utf8');
      for (const [ip] of text.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)) {
        assert.ok(ip === '127.0.0.1' || ip === '0.0.0.0', `${file}: ${ip}`);
      }
      for (const [url] of text.matchAll(/https?:\/\/[^\s/:'"`]+/g)) {
        assert.ok(/^https?:\/\/(?:<domen>|127\.0\.0\.1)$/.test(url), `${file}: ${url}`);
      }
    }
  });
});
