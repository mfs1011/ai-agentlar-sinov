# Bo'lib to'lash kalkulyatori — sinov loyihasi

Bu repozitoriy **"AI agentlar bilan dasturlash"** qo'llanmasining amaliy qismi uchun yaratilgan sinov loyihasi:
<https://mfs1011.github.io/dev-docs/ai-agentlar/>

Qo'llanmaning XI qismida ("Amaliy loyiha: boshidan oxirigacha") bitta kichik ilova AI agent (Claude Code) bilan bo'sh papkadan
serverda ishlaydigan holatgacha quriladi. Bu repo — o'sha jarayonning haqiqiy natijasi: kod, testlar, commit tarixi va PR'lar
boblardagi misollarning manbasi.

## Ilova nima qiladi

Summani (so'm, butun son) oylar soniga bo'lib, oylik to'lovlar jadvalini qaytaradi:

- to'lovlar yig'indisi summaga **aynan** teng;
- oylar orasidagi farq 1 so'mdan oshmaydi, ortiqcha so'mlar birinchi oylarga tushadi (`1000 / 3 → 334, 333, 333`);
- noto'g'ri kiritishda `400` va o'zbekcha xato xabari.

Tarkibi: HTTP API (`POST /api/installments`), oddiy veb-sahifa, Node.js 26, tashqi bog'liqliksiz (faqat `node:` modullari).

```bash
npm test                  # node:test
PORT=3000 npm start       # http://127.0.0.1:3000
```

## Qo'llanmadagi boblar va repo'dagi izlar

| Bob | Nima qilindi | Repo'da |
| --- | --- | --- |
| 48 — Loyihani boshlash | Reja rejimida reja va savollar, `CLAUDE.md`, skelet | `CLAUDE.md`, birinchi commit'lar |
| 49 — Funksiyani test bilan qurish | Avval test, keyin kod; brauzerda topilgan formatlash xatosi | `src/`, `public/`, `test/` |
| 50 — Review, xavfsizlik va PR | `/code-review`, `/security-review`, topilmalarni saralash, PR tavsifi | PR #1 (CSV yuklab olish) |
| 52 — Deploy va ishlab turgan ilova | systemd + Nginx, `/kalkulyator/` yo'li; foydalanuvchi xabari bo'yicha tuzatish | PR #2 (`deploy/`), PR #3 |

Kodning katta qismini agent yozgan; talablar, qarorlar, tekshiruv va review — inson. Har bobda so'rovlar, agent javoblari va narxlar
keltirilgan.

## Muhim

- Bu **sinov** loyihasi: o'quv maqsadida, production'da foydalanish uchun emas.
- PR'lar qo'llanmadagi bosqichlarni ko'rsatish uchun ochiq qoldirilgan.
- Repo'da hech qanday kirish ma'lumoti (token, kalit) yo'q va qo'shilmaydi.
