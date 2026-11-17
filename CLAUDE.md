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
- Statik fayllarni Node beradi (`public/`), faqat oq ro'yxat orqali.
- Server `PORT` muhit o'zgaruvchisidan, `HOST` standart `127.0.0.1` (Nginx orqasida).

## Ish tartibi
- Ish bosqichma-bosqich; har bosqich oxirida commit. **Push qilinmaydi.**
- Deploy (systemd, Nginx) — keyinroq alohida bosqich; hozircha deploy fayllari yozilmaydi.
