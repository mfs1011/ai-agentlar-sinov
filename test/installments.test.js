import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { split } from '../src/installments.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

describe('split: aniq misollar', () => {
  it('1000 / 3 → ortiqcha so\'m birinchi oyga', () => {
    assert.deepEqual(split(1000, 3), [334, 333, 333]);
  });

  it('1001 / 3 → ortiqcha so\'mlar birinchi ikki oyga', () => {
    assert.deepEqual(split(1001, 3), [334, 334, 333]);
  });

  it('900 / 3 → teng bo\'linadi', () => {
    assert.deepEqual(split(900, 3), [300, 300, 300]);
  });

  it('7 / 1 → bitta to\'lov', () => {
    assert.deepEqual(split(7, 1), [7]);
  });

  it('1 / 1', () => {
    assert.deepEqual(split(1, 1), [1]);
  });

  it('5 / 5 → hammasi 1', () => {
    assert.deepEqual(split(5, 5), [1, 1, 1, 1, 1]);
  });

  it('119 / 120 → oxirgi oy 0 (funksiya biznes chegarasini tekshirmaydi)', () => {
    const result = split(119, 120);
    assert.equal(result.length, 120);
    assert.equal(result[119], 0);
    assert.equal(sum(result), 119);
  });

  it('10^15 / 120 → yig\'indi aynan teng', () => {
    const amount = 10 ** 15;
    const result = split(amount, 120);
    assert.equal(result.length, 120);
    assert.equal(sum(result), amount);
    // 10^15 = 120 * 8333333333333 + 40
    assert.equal(result[0], 8_333_333_333_334);
    assert.equal(result[39], 8_333_333_333_334);
    assert.equal(result[40], 8_333_333_333_333);
    assert.equal(result[119], 8_333_333_333_333);
  });

  it('Number.MAX_SAFE_INTEGER / 7 → yig\'indi aynan teng', () => {
    const amount = Number.MAX_SAFE_INTEGER;
    assert.equal(sum(split(amount, 7)), amount);
  });

  it('yangi massiv qaytaradi (kiritishni o\'zgartirmaydi)', () => {
    const a = split(10, 3);
    const b = split(10, 3);
    assert.notEqual(a, b);
    assert.deepEqual(a, b);
  });
});

describe('split: noto\'g\'ri argumentlar', () => {
  const badIntegers = [1.5, NaN, Infinity, -Infinity, '10', null, undefined, 10n, 2 ** 53];

  for (const bad of badIntegers) {
    it(`amount = ${String(bad)} → TypeError`, () => {
      assert.throws(() => split(bad, 3), TypeError);
    });
    it(`months = ${String(bad)} → TypeError`, () => {
      assert.throws(() => split(10, bad), TypeError);
    });
  }

  it('months = 0 → RangeError', () => {
    assert.throws(() => split(10, 0), RangeError);
  });

  it('months manfiy → RangeError', () => {
    assert.throws(() => split(10, -1), RangeError);
  });

  it('amount manfiy → RangeError', () => {
    assert.throws(() => split(-1, 3), RangeError);
  });
});

describe('split: xossalar (tasodifiy, qayta takrorlanadigan)', () => {
  // mulberry32 — deterministik PRNG, yiqilgan holatni seed orqali qayta tiklash mumkin
  function mulberry32(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    };
  }

  const SEED = 20261117;
  const rand = mulberry32(SEED);
  const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

  it('1000 ta tasodifiy (amount, months) uchun barcha xossalar bajariladi', () => {
    for (let i = 0; i < 1000; i++) {
      const months = randInt(1, 120);
      // kichik, o'rta va katta summalarni aralashtirish
      const maxAmount = [10_000, 100_000_000, 10 ** 15][i % 3];
      const amount = randInt(months, maxAmount);
      const ctx = `seed=${SEED} i=${i} amount=${amount} months=${months}`;

      const result = split(amount, months);

      assert.equal(result.length, months, `uzunlik: ${ctx}`);
      assert.equal(sum(result), amount, `yig'indi: ${ctx}`);
      assert.ok(result.every(Number.isSafeInteger), `butun son: ${ctx}`);
      assert.ok(result.every((x) => x >= 1), `har biri ≥ 1: ${ctx}`);
      assert.ok(Math.max(...result) - Math.min(...result) <= 1, `farq ≤ 1: ${ctx}`);
      for (let k = 1; k < result.length; k++) {
        assert.ok(result[k - 1] >= result[k], `o'smaydigan tartib: ${ctx}`);
      }
    }
  });
});
