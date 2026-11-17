// DOM'ga bog'liq bo'lmagan yordamchi funksiyalar: brauzerda ham, Node testlarida ham ishlaydi.

const numberFormat = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 });

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
 * @param {number} n
 * @returns {string} masalan "1 000 so'm" (bo'shliqlar uzilmaydigan)
 */
export function formatSom(n) {
  return `${numberFormat.format(n)} so'm`;
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
