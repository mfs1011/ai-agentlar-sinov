# CLAUDE.md

## Buyruqlar
- `npm test` — barcha testlar (`node --test`, `test/**/*.test.js`).
- `PORT=3000 npm start` — serverni ishga tushirish (`HOST` ixtiyoriy, standart `127.0.0.1`). PORT yo'q/noto'g'ri bo'lsa exit 1. SIGTERM/SIGINT da toza to'xtaydi.

## Qat'iy cheklovlar
- Node.js ≥ 26, ES modullar. **Tashqi bog'liqliklar yo'q** — faqat `node:` modullari; `npm install <paket>` qilinmaydi.
- Testlar faqat `node:test` + `node:assert/strict`.

## Biznes qoidalari (kelishilgan)
- Summa — so'm, butun son. Bo'lishda ortiqcha so'mlar **birinchi oylarga** +1 dan: 1000/3 → 334, 333, 333.
- To'lovlar yig'indisi summaga aynan teng, oylar orasidagi farq ≤ 1 so'm. Float ishlatilmaydi.
- Chegaralar: `1 ≤ months ≤ 120`, `amount ≤ 10^15`, `amount ≥ months` (aks holda 400).
- Sana, foiz, ustama yo'q.

## API qoidalari
- `POST /api/installments`, body `{"amount": number, "months": number}`. Satr (`"1000"`) → 400; tozalash faqat frontendda (bo'shliqli "1 000 000").
- Xato formati: `{"error": {"code", "message", "details": [{"field", "message"}]}}`. Xabarlar **o'zbekcha (lotin)**.
- Statik fayllarni Node beradi (`public/`), faqat oq ro'yxat orqali (`STATIC_FILES`, `src/app.js`). `public/` ga yangi fayl qo'shilsa, oq ro'yxatga ham qo'shiladi — `static.test.js` buni tekshiradi.
- HTML'ga qat'iy CSP (`default-src 'self'`): inline `<script>`, `<style>`, `style=""`, `on*=""` ishlatilmaydi.
- `public/lib.js` DOM'siz bo'lishi kerak — u Node testlarida import qilinadi.
- Sonlarni formatlashda `Intl.NumberFormat`/`toLocaleString` **ishlatilmaydi**: `uz-UZ` Chrome'da "1,000,000", Node'da "1 000 000" beradi. Guruhlar qo'lda, NBSP (U+00A0) bilan (`formatSom`, `public/lib.js`).
- Server `PORT` muhit o'zgaruvchisidan, `HOST` standart `127.0.0.1` (Nginx orqasida).
- Frontend `/kalkulyator/` prefiksi ostida ham, ildizda ham ishlaydi: `public/` dagi barcha yo'llar (src/href, import, `fetch`, CSS `url()`) **nisbiy** (`app.js`, `api/installments`), `/` bilan boshlanmaydi — `base-path.test.js` tekshiradi.

## Ish tartibi
- Ish bosqichma-bosqich; har bosqich oxirida commit. **Push qilinmaydi.**
- Deploy fayllari `deploy/` da (systemd unit, Nginx parchasi, `DEPLOY.md`); port 3100, kod `/opt/kalkulyator`. Ularda haqiqiy domen/IP yo'q — `<domen>` (`deploy.test.js`). Serverga ulanilmaydi.
