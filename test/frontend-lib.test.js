import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumberInput, formatSom, groupErrors } from '../public/lib.js';

describe('parseNumberInput: formadagi matnni tozalash', () => {
  const cases = [
    ['1000', 1000],
    ['1 000 000', 1_000_000],
    ['  1 000 000  ', 1_000_000],
    ['1 000 000', 1_000_000], // uz-UZ formatidan nusxa (NBSP)
    ['1 000', 1000], // tor NBSP
    ['1\t000', 1000],
    ['12', 12],
    ['0', 0],
    ['-5', -5], // server "1 dan ... gacha" deb javob beradi
    ['10.5', 10.5], // server "butun son" deb javob beradi
    ['10,5', 10.5],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${expected}`, () => {
      assert.equal(parseNumberInput(input), expected);
    });
  }

  it('bo\'sh yoki faqat bo\'shliq → null (server "kiritilmagan" deydi)', () => {
    assert.equal(parseNumberInput(''), null);
    assert.equal(parseNumberInput('   '), null);
  });

  it('son bo\'lmagan matn o\'zgarmasdan (bo\'shliqsiz) qaytadi — server "son bo\'lishi kerak" deydi', () => {
    assert.equal(parseNumberInput('abc'), 'abc');
    assert.equal(parseNumberInput('1 000 so\'m'), '1000so\'m');
    assert.equal(parseNumberInput('1e3'), '1e3');
    assert.equal(parseNumberInput('1.000.000'), '1.000.000');
  });
});

describe('formatSom', () => {
  it('uz-UZ formatida, "so\'m" bilan', () => {
    assert.equal(formatSom(1000).replace(/\s/g, ' '), '1 000 so\'m');
    assert.equal(formatSom(334).replace(/\s/g, ' '), '334 so\'m');
    assert.equal(formatSom(10 ** 15).replace(/\s/g, ' '), '1 000 000 000 000 000 so\'m');
  });

  it('raqam va "so\'m" orasidagi bo\'shliq uzilmaydigan (qator bo\'linmasin)', () => {
    assert.match(formatSom(5), /^5 so'm$/);
  });
});

describe('groupErrors: API xatosini maydonlarga ajratish', () => {
  it('amount va months alohida, qolganlari umumiy', () => {
    const grouped = groupErrors({
      code: 'VALIDATION_ERROR',
      message: 'Kiritilgan ma\'lumotlar noto\'g\'ri',
      details: [
        { field: 'amount', message: 'A1' },
        { field: 'months', message: 'M1' },
        { field: 'body', message: 'B1' },
      ],
    });
    assert.deepEqual(grouped, { amount: 'A1', months: 'M1', general: ['B1'] });
  });

  it('bir maydonda bir nechta xato → birlashtiriladi', () => {
    const grouped = groupErrors({
      message: 'x',
      details: [
        { field: 'amount', message: 'A1' },
        { field: 'amount', message: 'A2' },
      ],
    });
    assert.equal(grouped.amount, 'A1. A2');
  });

  it('details bo\'sh bo\'lsa umumiy xabar ishlatiladi', () => {
    assert.deepEqual(groupErrors({ code: 'INVALID_JSON', message: 'JSON emas', details: [] }), {
      amount: null,
      months: null,
      general: ['JSON emas'],
    });
  });

  it('noma\'lum shakl (masalan, proksidan HTML) → umumiy xabar', () => {
    const grouped = groupErrors(undefined);
    assert.equal(grouped.amount, null);
    assert.equal(grouped.months, null);
    assert.equal(grouped.general.length, 1);
  });
});
