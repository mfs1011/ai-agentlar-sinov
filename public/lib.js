// DOM'ga bog'liq bo'lmagan yordamchi funksiyalar: brauzerda ham, Node testlarida ham ishlaydi.

const NBSP = ' ';

const FALLBACK_ERROR = 'Noma\'lum xato yuz berdi. Birozdan keyin qaytadan urinib ko\'ring.';

/**
 * Formadagi matnni API uchun qiymatga aylantiradi.
 * Bo'shliqlar (oddiy, NBSP, tor NBSP, tab) olib tashlanadi: "1 000 000" → 1000000.
 * Nuqta yoki vergul ming ajratuvchisi bo'lishi mumkin: "1.000.000", "1,000,000",
 * "1.000" → butun son. Shart: bitta xil ajratuvchi, birinchi guruh 1–3 raqam,
 * qolganlari aynan 3 raqam. So'mda tiyin yo'q, shuning uchun "1.000" = 1000.
 * Boshqa son ko'rinishidagi matn kasr deb olinadi ("1.5", "1,5" → 1.5) va
 * manfiy ham songa aylanadi — ularni server tushunarli xabar bilan rad etadi.
 * Bo'sh → null; boshqa matn (noto'g'ri guruhlash, aralash ajratuvchilar)
 * o'zicha qoladi — taxmin qilinmaydi.
 *
 * @param {string} raw
 * @returns {number | string | null}
 */
export function parseNumberInput(raw) {
  const cleaned = String(raw).replace(/\s+/g, '');
  if (cleaned === '') return null;
  if (/^-?\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/.test(cleaned)) return Number(cleaned.replace(/[.,]/g, ''));
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
