# Deploy: Ubuntu 26.04 + Nginx (mavjud HTTPS domen ostida `/kalkulyator/`)

Sxema:

```
brauzer ──HTTPS──▶ Nginx (<domen>)  location ^~ /kalkulyator/
                        │  prefiks olib tashlanadi: /kalkulyator/app.js → /app.js
                        ▼
                 127.0.0.1:3100  node /opt/kalkulyator/src/server.js  (systemd, user: kalkulyator)
```

| Fayl | Serverdagi joyi |
|---|---|
| `deploy/kalkulyator.service` | `/etc/systemd/system/kalkulyator.service` |
| `deploy/nginx-kalkulyator.conf` | `/etc/nginx/snippets/kalkulyator.conf` |
| kod (butun repo) | `/opt/kalkulyator` — egasi `root`, xizmat uchun faqat o'qish |

Matndagi `<domen>` — haqiqiy domen, `<ssh>` — serverga SSH manzil (`foydalanuvchi@host`).
Buyruqlar `sudo` huquqli foydalanuvchi nomidan bajariladi.

---

## 0. Lokal: tekshirish va arxiv

```sh
npm test
git status --short            # bo'sh bo'lishi kerak — arxivga faqat commit qilingan kod tushadi
git archive --format=tar.gz -o kalkulyator.tar.gz HEAD
scp kalkulyator.tar.gz <ssh>:/tmp/
```

## 1. Server: dastlabki tekshiruv

```sh
/usr/local/bin/node --version          # v26.x yoki yangiroq
nginx -v                               # nginx/1.31.x
ss -ltn 'sport = :3100'                # bo'sh bo'lishi kerak (port band emas)
systemctl --version | head -1
```

## 2. Tizim foydalanuvchisi

Login yo'q, uy papkasi yo'q, faqat xizmatni ishga tushirish uchun:

```sh
sudo useradd --system --user-group --no-create-home \
     --home-dir /nonexistent --shell /usr/sbin/nologin kalkulyator
id kalkulyator
```

## 3. Kodni joylash (`/opt/kalkulyator`, egasi root)

```sh
sudo rm -rf /opt/kalkulyator.new
sudo mkdir /opt/kalkulyator.new
sudo tar -xzf /tmp/kalkulyator.tar.gz -C /opt/kalkulyator.new --no-same-owner
sudo chown -R root:root /opt/kalkulyator.new
sudo chmod -R u=rwX,go=rX /opt/kalkulyator.new

# Birinchi o'rnatishda /opt/kalkulyator yo'q — shunchaki nomini o'zgartiramiz.
# Yangilashda — 8-bo'limga qarang.
sudo mv /opt/kalkulyator.new /opt/kalkulyator
rm /tmp/kalkulyator.tar.gz
```

Tashqi bog'liqliklar yo'q — `npm install` kerak emas.

Ixtiyoriy: testlarni serverning o'zida, xizmat foydalanuvchisi nomidan ishga tushirish
(testlar faqat 127.0.0.1 da tasodifiy portlarni ochadi, diskka yozmaydi):

```sh
cd /opt/kalkulyator && sudo -u kalkulyator /usr/local/bin/node --test
```

## 4. systemd xizmati

```sh
sudo install -m 0644 -o root -g root /opt/kalkulyator/deploy/kalkulyator.service \
     /etc/systemd/system/kalkulyator.service
sudo systemd-analyze verify /etc/systemd/system/kalkulyator.service   # xato chiqmasligi kerak
sudo systemctl daemon-reload
sudo systemctl enable --now kalkulyator
```

Tekshiruv:

```sh
systemctl status kalkulyator --no-pager           # active (running)
journalctl -u kalkulyator -n 20 --no-pager        # "Server ishga tushdi: http://127.0.0.1:3100"
sudo ss -ltnp 'sport = :3100'                     # faqat 127.0.0.1:3100, 0.0.0.0 EMAS
ps -o user=,pid=,cmd= -p "$(systemctl show -p MainPID --value kalkulyator)"   # user: kalkulyator

curl -fsS http://127.0.0.1:3100/healthz           # {"status":"ok"}
curl -fsS -X POST http://127.0.0.1:3100/api/installments \
     -H 'Content-Type: application/json' -d '{"amount":1000,"months":3}'
# → payments: 334, 333, 333

systemd-analyze security kalkulyator --no-pager | tail -1   # ballni yozib qo'ying ("OK" yoki past)
```

Kod faqat o'qish uchun ekanini tekshirish:

```sh
sudo -u kalkulyator touch /opt/kalkulyator/x      # "Permission denied" bo'lishi kerak
```

## 5. Nginx

```sh
sudo install -m 0644 -o root -g root /opt/kalkulyator/deploy/nginx-kalkulyator.conf \
     /etc/nginx/snippets/kalkulyator.conf
```

`<domen>` uchun mavjud **HTTPS** `server { listen 443 ssl; ... }` blokini oching
(odatda `/etc/nginx/sites-available/<domen>`) va ichiga, boshqa `location`lar yoniga, bitta qator qo'shing:

```nginx
    include snippets/kalkulyator.conf;
```

Diqqat:
- Bu blokda allaqachon `location /kalkulyator` yoki `location = /kalkulyator` bo'lmasligi kerak
  (`sudo grep -rn kalkulyator /etc/nginx/` bilan tekshiring) — aks holda `nginx -t` "duplicate location" deydi.
- Snippetdagi `^~` server blokidagi regex location'lardan (`~* \.(js|css)$` va h.k.) ustun turadi,
  shuning uchun `/kalkulyator/app.js` ilovaga boradi, diskdan qidirilmaydi.

```sh
sudo nginx -t                    # "syntax is ok" va "test is successful"
sudo systemctl reload nginx
```

## 6. Tashqaridan tekshiruv (istalgan kompyuterdan)

```sh
# Prefiks oxirida "/" siz → 301 /kalkulyator/
curl -sSI https://<domen>/kalkulyator | grep -iE '^(HTTP|location)'

# Sahifa: 200, text/html, CSP sarlavhasi Nginx orqali yetib keladi
curl -sSI https://<domen>/kalkulyator/ | grep -iE '^(HTTP|content-type|content-security-policy)'

# Sahifadagi nisbiy resurslar prefiks ostida
for p in style.css app.js lib.js healthz; do
  printf '%-10s ' "$p"; curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "https://<domen>/kalkulyator/$p"
done
# hammasi 200; css → text/css, js → text/javascript

# API
curl -sS -X POST https://<domen>/kalkulyator/api/installments \
     -H 'Content-Type: application/json' -d '{"amount":1000,"months":3}'
# validatsiya xatosi o'zbekcha, 400
curl -sS -w '\n%{http_code}\n' -X POST https://<domen>/kalkulyator/api/installments \
     -H 'Content-Type: application/json' -d '{"amount":"1000","months":3}'

# Port tashqaridan ochiq emas (bu buyruq vaqt tugashi yoki rad etish bilan tugashi kerak)
curl -m 5 http://<domen>:3100/healthz
```

Brauzerda: `https://<domen>/kalkulyator/` ni oching, 1 000 000 / 12 ni hisoblang.
DevTools → Network: barcha so'rovlar `/kalkulyator/...` ostida, 200; Console'da CSP xatolari yo'q.
Domendagi boshqa saytlar (ildiz va boshqa yo'llar) avvalgidek ishlashini ham tekshiring.

## 7. Qayta ishga tushish va loglar

```sh
sudo systemctl restart kalkulyator
journalctl -u kalkulyator -f
```

Toza to'xtashni tekshirish (SIGTERM → "SIGTERM olindi, server to'xtatilmoqda...", exit 0):

```sh
sudo systemctl stop kalkulyator
journalctl -u kalkulyator -n 5 --no-pager
sudo systemctl start kalkulyator
```

Server qayta yuklanganda avtomatik ishga tushishini tekshirish: `systemctl is-enabled kalkulyator` → `enabled`.

## 8. Yangilash va orqaga qaytarish

0-bo'limdagidek yangi arxivni `/tmp/` ga yuklang, 3-bo'limdagidek `/opt/kalkulyator.new` ga oching
(oxirgi `mv` dan oldin to'xtang), so'ng:

```sh
sudo rm -rf /opt/kalkulyator.old
sudo mv /opt/kalkulyator /opt/kalkulyator.old
sudo mv /opt/kalkulyator.new /opt/kalkulyator
sudo systemctl restart kalkulyator
curl -fsS http://127.0.0.1:3100/healthz
```

Agar `deploy/` dagi fayllar o'zgargan bo'lsa — 4- va 5-bo'limdagi `install` buyruqlarini qaytaring
(`daemon-reload` / `nginx -t && reload` bilan).

Orqaga qaytarish:

```sh
sudo rm -rf /opt/kalkulyator.bad
sudo mv /opt/kalkulyator /opt/kalkulyator.bad
sudo mv /opt/kalkulyator.old /opt/kalkulyator
sudo systemctl restart kalkulyator
```

## 9. Muammolar

| Belgi | Sabab / tekshirish |
|---|---|
| `/kalkulyator/` ochiladi, lekin stil yo'q, "Server bilan bog'lanib bo'lmadi" | Sahifa `/kalkulyator` ("/" siz) ochilgan va 301 ishlamagan — `location = /kalkulyator` borligini tekshiring |
| `/kalkulyator/app.js` → 404 Nginx sahifasi | Regex location ushlab qolgan — snippetda `^~` borligini, `include` to'g'ri `server` blokida ekanini tekshiring |
| 502 Bad Gateway | Xizmat ishlamayapti: `systemctl status kalkulyator`, `journalctl -u kalkulyator -n 50` |
| Xizmat darhol yiqiladi, logda `Sozlamada xato` | Unit'dagi `PORT` noto'g'ri |
| Logda `EADDRINUSE` | 3100 band: `sudo ss -ltnp 'sport = :3100'` |
| Logda `EACCES`/`EPERM` | Fayl huquqlari (`ls -l /opt/kalkulyator`) yoki sandbox cheklovi; vaqtincha sinash uchun `systemctl edit kalkulyator` orqali shubhali direktivani o'chirib ko'ring |
