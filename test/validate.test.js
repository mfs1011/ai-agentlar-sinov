import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, LIMITS } from '../src/validate.js';

function assertFieldError(body, field) {
  const result = validateInput(body);
  assert.equal(result.ok, false, `ok:false kutilgan: ${JSON.stringify(body)}`);
  const fields = result.errors.map((e) => e.field);
  assert.ok(fields.includes(field), `${field} xatosi kutilgan, bor: ${fields.join(', ')}`);
  for (const e of result.errors) {
    assert.equal(typeof e.message, 'string');
    assert.ok(e.message.length > 0);
  }
  return result;
}

describe('LIMITS', () => {
  it('kelishilgan chegaralar', () => {
    assert.deepEqual(LIMITS, { MIN_MONTHS: 1, MAX_MONTHS: 120, MAX_AMOUNT: 10 ** 15 });
  });
});

describe('validateInput: to\'g\'ri kirish', () => {
  it('oddiy holat', () => {
    assert.deepEqual(validateInput({ amount: 1000, months: 3 }), {
      ok: true,
      value: { amount: 1000, months: 3 },
    });
  });

  it('ortiqcha maydonlar e\'tiborsiz qoldiriladi va natijaga kirmaydi', () => {
    assert.deepEqual(validateInput({ amount: 10, months: 2, foo: 'bar' }), {
      ok: true,
      value: { amount: 10, months: 2 },
    });
  });

  it('chegaralar ichida: months=1, months=120, amount=months, amount=MAX', () => {
    assert.equal(validateInput({ amount: 1, months: 1 }).ok, true);
    assert.equal(validateInput({ amount: 120, months: 120 }).ok, true);
    assert.equal(validateInput({ amount: 10 ** 15, months: 120 }).ok, true);
  });

  it('1e3 (JSON\'dan 1000 bo\'lib keladi) qabul qilinadi', () => {
    assert.equal(validateInput(JSON.parse('{"amount":1e3,"months":3}')).ok, true);
    assert.equal(validateInput(JSON.parse('{"amount":1000.0,"months":3}')).ok, true);
  });
});

describe('validateInput: body shakli', () => {
  for (const body of [null, undefined, [], [1, 2], 42, 'matn', true]) {
    it(`body = ${JSON.stringify(body)} → field "body"`, () => {
      const r = assertFieldError(body, 'body');
      assert.equal(r.errors.length, 1);
    });
  }
});

describe('validateInput: noto\'g\'ri qiymatlar', () => {
  const badValues = [
    ['yo\'q', undefined],
    ['null', null],
    ['satr "1000"', '1000'],
    ['bo\'sh satr', ''],
    ['true', true],
    ['massiv', [10]],
    ['obyekt', { v: 10 }],
    ['kasr 10.5', 10.5],
    ['NaN', NaN],
    ['Infinity (1e400)', JSON.parse('1e400')],
    ['-Infinity', -Infinity],
    ['manfiy', -5],
    ['nol', 0],
  ];

  for (const [name, bad] of badValues) {
    it(`amount: ${name}`, () => {
      const body = { months: 3 };
      if (bad !== undefined) body.amount = bad;
      assertFieldError(body, 'amount');
    });
    it(`months: ${name}`, () => {
      const body = { amount: 1000 };
      if (bad !== undefined) body.months = bad;
      assertFieldError(body, 'months');
    });
  }

  it('months = 121 → xato', () => {
    assertFieldError({ amount: 1000, months: 121 }, 'months');
  });

  it('amount = 10^15 + 1 → xato', () => {
    assertFieldError({ amount: 10 ** 15 + 1, months: 3 }, 'amount');
  });

  it('amount < months → amount xatosi', () => {
    const r = assertFieldError({ amount: 119, months: 120 }, 'amount');
    assert.equal(r.errors.length, 1);
  });

  it('ikkala maydon xato → ikkala xato ham qaytadi', () => {
    const r = validateInput({ amount: 'x', months: 0 });
    assert.equal(r.ok, false);
    assert.deepEqual(r.errors.map((e) => e.field).sort(), ['amount', 'months']);
  });

  it('months noto\'g\'ri bo\'lsa amount < months tekshirilmaydi (bitta xato)', () => {
    const r = validateInput({ amount: 5, months: 500 });
    assert.deepEqual(r.errors.map((e) => e.field), ['months']);
  });
});

describe('validateInput: xabarlar', () => {
  it('xabarlar o\'zbekcha va tushunarli', () => {
    const missing = validateInput({});
    assert.match(missing.errors.find((e) => e.field === 'amount').message, /Summa/);
    assert.match(missing.errors.find((e) => e.field === 'months').message, /Oylar soni/);

    const tooFew = validateInput({ amount: 2, months: 3 });
    assert.match(tooFew.errors[0].message, /oylar sonidan kam/);

    const tooMany = validateInput({ amount: 1000, months: 121 });
    assert.match(tooMany.errors[0].message, /120/);
  });
});
