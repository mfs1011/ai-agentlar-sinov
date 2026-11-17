export const LIMITS = Object.freeze({
  MIN_MONTHS: 1,
  MAX_MONTHS: 120,
  MAX_AMOUNT: 10 ** 15,
});

const formatSom = (n) => n.toLocaleString('en-US').replaceAll(',', ' ');

const FIELDS = {
  amount: {
    label: 'Summa',
    min: 1,
    max: LIMITS.MAX_AMOUNT,
    rangeMessage: `Summa 1 dan ${formatSom(LIMITS.MAX_AMOUNT)} so'mgacha bo'lishi kerak`,
  },
  months: {
    label: 'Oylar soni',
    min: LIMITS.MIN_MONTHS,
    max: LIMITS.MAX_MONTHS,
    rangeMessage: `Oylar soni ${LIMITS.MIN_MONTHS} dan ${LIMITS.MAX_MONTHS} gacha bo'lishi kerak`,
  },
};

/** Bitta maydonni tekshiradi; xato bo'lsa xabar, aks holda null qaytaradi. */
function checkField(body, name) {
  const { label, min, max, rangeMessage } = FIELDS[name];

  if (!Object.hasOwn(body, name) || body[name] === null) {
    return `${label} kiritilmagan`;
  }
  const value = body[name];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return `${label} son bo'lishi kerak (masalan, 1000)`;
  }
  if (Number.isFinite(value) && !Number.isInteger(value)) {
    return `${label} butun son bo'lishi kerak`;
  }
  if (value < min || value > max) {
    return rangeMessage;
  }
  return null;
}

/**
 * API so'rov tanasini tekshiradi.
 *
 * @param {unknown} body  JSON.parse natijasi
 * @returns {{ok: true, value: {amount: number, months: number}}
 *         | {ok: false, errors: {field: string, message: string}[]}}
 */
export function validateInput(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      errors: [{ field: 'body', message: 'So\'rov tanasi {"amount": ..., "months": ...} ko\'rinishidagi JSON obyekt bo\'lishi kerak' }],
    };
  }

  const errors = [];
  for (const field of ['amount', 'months']) {
    const message = checkField(body, field);
    if (message) errors.push({ field, message });
  }

  if (errors.length === 0 && body.amount < body.months) {
    errors.push({
      field: 'amount',
      message: 'Summa oylar sonidan kam bo\'lmasligi kerak (har oyga kamida 1 so\'m)',
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { amount: body.amount, months: body.months } };
}
