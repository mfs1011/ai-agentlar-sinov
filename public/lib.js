// DOM'ga bog'liq bo'lmagan yordamchi funksiyalar: brauzerda ham, Node testlarida ham ishlaydi.

const NBSP = ' ';

const FALLBACK_ERROR = 'Noma\'lum xato yuz berdi. Birozdan keyin qaytadan urinib ko\'ring.';

/**
 * Formadagi matnni API uchun qiymatga aylantiradi.
 * Bo'shliqlar (oddiy, NBSP, tor NBSP, tab) olib tashlanadi: "1 000 000" → 1000000.
 * Son ko'rinishidagi matn songa aylanadi (kasr va manfiy ham — ularni server
 * tushunarli xabar bilan rad etadi); bo'sh → null; boshqa matn o'zicha qoladi.
 *
 * @param {string} raw
 * @returns {number | string | null}
 */
export function parseNumberInput(raw) {
  const cleaned = String(raw).replace(/\s+/g, '');
  if (cleaned === '') return null;
  if (/^-?\d+(?:[.,]\d+)?$/.test(cleaned)) return Number(cleaned.replace(',', '.'));
  return cleaned;
}

/**
 * Summani "1 000 000 so'm" ko'rinishida formatlaydi: guruhlar va "so'm" oldidagi
 * bo'shliq — NBSP (U+00A0).
 *
 * Intl.NumberFormat / toLocaleString ataylab ishlatilmaydi: 'uz-UZ' lokali
 * brauzer va Node'da turlicha ma'lumotga ega (Chrome "1,000,000" beradi,
 * Node "1 000 000"), natija hamma joyda bir xil bo'lishi kerak.
 *
 * @param {number} n  xavfsiz butun son
 * @returns {string}
 */
export function formatSom(n) {
  if (!Number.isSafeInteger(n)) {
    throw new TypeError(`formatSom: xavfsiz butun son kutilgan, berilgan: ${String(n)}`);
  }
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(n));
  const grouped = digits.replace(/\B(?=(\d{3})+$)/g, NBSP);
  return `${sign}${grouped}${NBSP}so'm`;
}

/**
 * API xato obyektini forma maydonlari bo'yicha guruhlaydi.
 *
 * @param {{message?: string, details?: {field: string, message: string}[]} | undefined} error
 * @returns {{amount: string | null, months: string | null, general: string[]}}
 */
export function groupErrors(error) {
  const out = { amount: null, months: null, general: [] };

  const details = Array.isArray(error?.details) ? error.details : [];
  for (const { field, message } of details) {
    if (field === 'amount' || field === 'months') {
      out[field] = out[field] ? `${out[field]}. ${message}` : message;
    } else {
      out.general.push(message);
    }
  }

  if (!out.amount && !out.months && out.general.length === 0) {
    const message = typeof error?.message === 'string' && error.message ? error.message : FALLBACK_ERROR;
    out.general.push(message);
  }
  return out;
}

const CSV_EOL = '\r\n'; // RFC 4180

function assertSafeInteger(fn, name, value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fn}: ${name} xavfsiz butun son bo'lishi kerak, berilgan: ${String(value)}`);
  }
}

/**
 * To'lovlar jadvalini CSV matniga aylantiradi: "Oy,To'lov" sarlavhasi, har oy
 * uchun "<oy>,<to'lov>" qatori va oxirida "Jami,<yig'indi>". Summalar so'mda,
 * formatlashsiz (guruhlash va "so'm"siz) — jadval dasturlari son deb o'qishi uchun.
 * Qiymatlar faqat butun son va "Jami", shuning uchun qo'shtirnoq/escape kerak emas.
 *
 * @param {{month: number, amount: number}[]} payments
 * @returns {string}
 */
export function buildPaymentsCsv(payments) {
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new TypeError('buildPaymentsCsv: to\'lovlar ro\'yxati bo\'sh bo\'lmasligi kerak');
  }
  const lines = ["Oy,To'lov"];
  let total = 0;
  for (const { month, amount } of payments) {
    assertSafeInteger('buildPaymentsCsv', 'month', month);
    assertSafeInteger('buildPaymentsCsv', 'amount', amount);
    total += amount;
    lines.push(`${month},${amount}`);
  }
  assertSafeInteger('buildPaymentsCsv', 'Jami', total);
  lines.push(`Jami,${total}`);
  return lines.join(CSV_EOL) + CSV_EOL;
}

/**
 * Yuklab olinadigan CSV fayl nomi: tolovlar-<summa>-<oylar>.csv.
 *
 * @param {number} amount
 * @param {number} months
 * @returns {string}
 */
export function csvFileName(amount, months) {
  assertSafeInteger('csvFileName', 'amount', amount);
  assertSafeInteger('csvFileName', 'months', months);
  return `tolovlar-${amount}-${months}.csv`;
}
