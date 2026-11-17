/**
 * Summani oylar bo'yicha butun so'mlarda teng bo'ladi.
 *
 * Ortiqcha so'mlar birinchi oylarga 1 so'mdan qo'shiladi:
 * split(1000, 3) → [334, 333, 333].
 * Natija yig'indisi aynan `amount`, elementlar orasidagi farq ≤ 1.
 *
 * Biznes chegaralari (months ≤ 120, amount ≥ months va h.k.) bu yerda
 * tekshirilmaydi — ular validate.js da. Bu funksiya faqat matematik
 * shartlarni talab qiladi.
 *
 * @param {number} amount  manfiy bo'lmagan xavfsiz butun son
 * @param {number} months  musbat xavfsiz butun son
 * @returns {number[]}     uzunligi `months` bo'lgan massiv
 * @throws {TypeError}     argument xavfsiz butun son bo'lmasa
 * @throws {RangeError}    amount < 0 yoki months < 1 bo'lsa
 */
export function split(amount, months) {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError('amount xavfsiz butun son bo\'lishi kerak');
  }
  if (!Number.isSafeInteger(months)) {
    throw new TypeError('months xavfsiz butun son bo\'lishi kerak');
  }
  if (amount < 0) {
    throw new RangeError('amount manfiy bo\'lmasligi kerak');
  }
  if (months < 1) {
    throw new RangeError('months kamida 1 bo\'lishi kerak');
  }

  const base = Math.floor(amount / months);
  const remainder = amount % months;

  return Array.from({ length: months }, (_, i) => (i < remainder ? base + 1 : base));
}
