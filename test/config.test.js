import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePort, loadConfig } from '../src/config.js';

describe('parsePort', () => {
  for (const [raw, expected] of [['3000', 3000], ['1', 1], ['65535', 65535], ['8080', 8080]]) {
    it(`"${raw}" → ${expected}`, () => {
      assert.equal(parsePort(raw), expected);
    });
  }

  for (const raw of [undefined, '', '   ', 'abc', '0', '-1', '65536', '70000', '30.5', '3000abc', ' 3000', '1e3', '0x50']) {
    it(`${JSON.stringify(raw)} → xato`, () => {
      assert.throws(() => parsePort(raw), /PORT/);
    });
  }
});

describe('loadConfig', () => {
  it('HOST berilmasa 127.0.0.1', () => {
    assert.deepEqual(loadConfig({ PORT: '3000' }), { port: 3000, host: '127.0.0.1' });
  });

  it('HOST berilsa o\'sha ishlatiladi', () => {
    assert.deepEqual(loadConfig({ PORT: '3000', HOST: '0.0.0.0' }), { port: 3000, host: '0.0.0.0' });
  });

  it('PORT yo\'q → xato', () => {
    assert.throws(() => loadConfig({}), /PORT/);
  });
});
