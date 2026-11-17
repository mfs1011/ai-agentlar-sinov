import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumberInput, formatSom, groupErrors, buildPaymentsCsv, csvFileName } from '../public/lib.js';

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

describe('buildPaymentsCsv: to\'lovlar jadvali CSV ko\'rinishida', () => {
  const payments = [
    { month: 1, amount: 334 },
    { month: 2, amount: 333 },
    { month: 3, amount: 333 },
  ];

  it('sarlavha, har oy bitta qator, oxirida Jami; qatorlar CRLF bilan', () => {
    assert.equal(
      buildPaymentsCsv(payments),
      "Oy,To'lov\r\n1,334\r\n2,333\r\n3,333\r\nJami,1000\r\n",
    );
  });

  it('katta summa formatlashsiz: guruhlash, bo\'shliq, "so\'m" yo\'q', () => {
    const csv = buildPaymentsCsv([{ month: 1, amount: 1_000_000_000_000_000 }]);
    assert.equal(csv, "Oy,To'lov\r\n1,1000000000000000\r\nJami,1000000000000000\r\n");
    assert.doesNotMatch(csv.replaceAll('\r\n', ''), /\s|so'm/);
  });

  it('Jami — to\'lovlar yig\'indisi va oxirgi qator', () => {
    const lines = buildPaymentsCsv(payments).trimEnd().split('\r\n');
    assert.equal(lines.length, 1 + payments.length + 1);
    assert.equal(lines.at(-1), 'Jami,1000');
  });

  it('noto\'g\'ri ma\'lumot → TypeError', () => {
    assert.throws(() => buildPaymentsCsv([]), TypeError);
    assert.throws(() => buildPaymentsCsv(null), TypeError);
    assert.throws(() => buildPaymentsCsv([{ month: 1, amount: 10.5 }]), TypeError);
    assert.throws(() => buildPaymentsCsv([{ month: 1, amount: '1000' }]), TypeError);
    assert.throws(() => buildPaymentsCsv([{ month: 1.5, amount: 1000 }]), TypeError);
  });
});

describe('csvFileName: yuklab olinadigan fayl nomi', () => {
  it('tolovlar-<summa>-<oylar>.csv, summa formatlashsiz', () => {
    assert.equal(csvFileName(1000, 3), 'tolovlar-1000-3.csv');
    assert.equal(csvFileName(1_000_000, 12), 'tolovlar-1000000-12.csv');
  });

  it('butun bo\'lmagan qiymat → TypeError', () => {
    assert.throws(() => csvFileName(10.5, 3), TypeError);
    assert.throws(() => csvFileName(1000, '3'), TypeError);
  });
});
