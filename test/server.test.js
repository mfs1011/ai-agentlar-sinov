import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../src/server.js', import.meta.url));

function startProcess(env) {
  const child = spawn(process.execPath, [SERVER], {
    env: { PATH: process.env.PATH, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => (stdout += c));
  child.stderr.on('data', (c) => (stderr += c));
  const exited = once(child, 'exit').then(([code, signal]) => ({ code, signal }));
  return { child, exited, out: () => stdout, err: () => stderr };
}

async function freePort() {
  const srv = createServer();
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  const { port } = srv.address();
  srv.close();
  await once(srv, 'close');
  return port;
}

async function waitFor(predicate, timeoutMs = 5000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('kutish vaqti tugadi');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('server.js jarayoni', () => {
  it('PORT yo\'q → stderr da tushunarli xabar, exit 1', async () => {
    const p = startProcess({});
    const { code } = await p.exited;
    assert.equal(code, 1);
    assert.match(p.err(), /PORT/);
  });

  it('PORT noto\'g\'ri → exit 1', async () => {
    const p = startProcess({ PORT: 'abc' });
    const { code } = await p.exited;
    assert.equal(code, 1);
    assert.match(p.err(), /PORT/);
  });

  it('ishga tushadi, /healthz javob beradi, SIGTERM da toza chiqadi (exit 0)', async () => {
    const port = await freePort();
    const p = startProcess({ PORT: String(port) });
    try {
      await waitFor(() => p.out().includes(`127.0.0.1:${port}`));
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      assert.equal(res.status, 200);
      p.child.kill('SIGTERM');
      const { code } = await p.exited;
      assert.equal(code, 0);
    } finally {
      p.child.kill('SIGKILL');
    }
  });
});
