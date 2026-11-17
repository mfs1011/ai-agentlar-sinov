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
    // Ming ajratuvchisi sifatida nuqta/vergul (telefonda "1.000.000" yoziladi)
    ['1.000.000', 1_000_000],
    ['1,000,000', 1_000_000],
    ['1.000', 1000],
    ['12.345.678', 12_345_678],
    [' 1.000.000 ', 1_000_000],
    ['-1.000', -1000],
    // Ajratuvchidan keyin aynan 3 raqam bo'lmasa — kasr (server "butun son" deydi)
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['1.50', 1.5],
    ['1.0000', 1],
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
    // noto'g'ri guruhlash yoki aralash ajratuvchilar — taxmin qilinmaydi
    assert.equal(parseNumberInput('1.000.00'), '1.000.00');
    assert.equal(parseNumberInput('1.00.000'), '1.00.000');
    assert.equal(parseNumberInput('1.000,000'), '1.000,000');
    assert.equal(parseNumberInput('1.000.000,50'), '1.000.000,50');
    assert.equal(parseNumberInput('.000'), '.000');
  });
});

describe('formatSom', () => {
  // Aniq satr: guruh ajratuvchi va "so'm" oldidagi bo'shliq — faqat NBSP (U+00A0)
  const NB = ' ';
  const cases = [
    [0, `0${NB}so'm`],
    [5, `5${NB}so'm`],
    [334, `334${NB}so'm`],
    [999, `999${NB}so'm`],
    [1000, `1${NB}000${NB}so'm`],
    [12_345, `12${NB}345${NB}so'm`],
    [142_858, `142${NB}858${NB}so'm`],
    [1_000_000, `1${NB}000${NB}000${NB}so'm`],
    [8_333_333_333_334, `8${NB}333${NB}333${NB}333${NB}334${NB}so'm`],
    [10 ** 15, `1${NB}000${NB}000${NB}000${NB}000${NB}000${NB}so'm`],
    [Number.MAX_SAFE_INTEGER, `9${NB}007${NB}199${NB}254${NB}740${NB}991${NB}so'm`],
  ];
  for (const [n, expected] of cases) {
    it(`${n} → ${JSON.stringify(expected)}`, () => {
      assert.equal(formatSom(n), expected);
    });
  }

  it('xavfsiz butun son bo\'lmasa → TypeError', () => {
    for (const bad of [1.5, NaN, Infinity, 2 ** 53, '1000', null]) {
      assert.throws(() => formatSom(bad), TypeError, String(bad));
    }
  });

  it('muhitga bog\'liq emas: Intl/toLocaleString Chrome kabi "1,000,000" qaytarsa ham', async (t) => {
    // Chrome 157 da Intl.NumberFormat('uz-UZ') vergul bilan formatlaydi.
    // Shuni taqlid qilamiz va lib.js ni yangidan yuklaymiz.
    const chromeLike = new Intl.NumberFormat('en-US');
    const OriginalNF = Intl.NumberFormat;
    const originalToLocale = Number.prototype.toLocaleString;
    Intl.NumberFormat = function NumberFormat() { return chromeLike; };
    Number.prototype.toLocaleString = function toLocaleString() { return chromeLike.format(this); };
    t.after(() => {
      Intl.NumberFormat = OriginalNF;
      Number.prototype.toLocaleString = originalToLocale;
    });

    // taqlid ishlayotganiga ishonch hosil qilish
    assert.equal(new Intl.NumberFormat('uz-UZ').format(1_000_000), '1,000,000');

    const { formatSom: fresh } = await import('../public/lib.js?chrome-like-intl');
    assert.equal(fresh(1_000_000), `1${NB}000${NB}000${NB}so'm`);
    assert.equal(fresh(142_858), `142${NB}858${NB}so'm`);
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
