# Telegram “Spotify-like” Mini App (Full Starter) + ЮKassa + Postgres

Это **полноценный стартовый проект**:
- Mini App (Vite + React) — каталог, поиск, плеер, избранное, профиль, trial, оплата, админ-загрузка треков.
- Backend (Node.js + Express) — Telegram initData auth, роли, подписка/доступ, ЮKassa create payment + webhook, стриминг аудио, избранное.
- Postgres (docker-compose)
- Опционально: Bot (Node.js) — отправляет кнопку открытия WebApp.

> MVP-логика подписки: успешный платёж = доступ на N дней (PLAN_BASIC_DAYS).
> Для рекуррентной автоподписки нужно расширение (сохранение payment_method_id и автоплатежи).

---

## 0) Требования (Windows 10)
- Node.js 18+
- Docker Desktop (WSL2, виртуализация включена)
- Git (не обязательно)
- VS Code (не обязательно)

---

## 1) Установка и запуск (локально)

### 1.1 Backend + DB
```bash
cd backend
copy .env.example .env
docker compose up -d
npm i
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Проверка:
- http://localhost:3000/health -> { ok: true }

### 1.2 Frontend
```bash
cd ../frontend
copy .env.example .env
npm i
npm run dev
```

Открыть:
- http://localhost:5173

> Важно: авторизация работает **только внутри Telegram**, потому что нужен initData.
> Для теста в Telegram нужен HTTPS URL (см. ниже).

---

## 2) Тест в Telegram (через HTTPS)

### Вариант A: Cloudflare Tunnel (рекомендуется)
1) Установить cloudflared
2) Запустить:
```bash
cloudflared tunnel --url http://localhost:5173
```
Получишь HTTPS URL вида https://xxxx.trycloudflare.com — его и указывай боту как WebApp URL.

### Вариант B: ngrok
```bash
ngrok http 5173
```

---

## 3) Бот (кнопка “Открыть приложение”)
```bash
cd bot
copy .env.example .env
npm i
npm run dev
```
Команда в Telegram: `/start` — придет кнопка WebApp.

---

## 4) Как стать админом (только ты можешь загружать музыку)
В `backend/.env`:
- `ADMIN_TELEGRAM_IDS=123456789`

Это должен быть **numeric Telegram user id** (не username).
Узнать можно через @userinfobot.

После изменения:
```bash
cd backend
npm run seed
```

---

## 5) ЮKassa
В `backend/.env` укажи:
- `YOOKASSA_SHOP_ID=...`
- `YOOKASSA_SECRET_KEY=...`

Webhook URL (в кабинете ЮKassa):
- `https://<твой-домен>/billing/yookassa/webhook`

Локально можно пробрасывать backend через tunnel (5173 — фронт, 3000 — бек).

---

## 6) Добавление треков (админ)
В Mini App появится раздел **Admin**:
- Create track
- Upload MP3
- Publish

После публикации трек виден всем в каталоге.

---

## 7) Продакшен замечания
- Для реального стриминга лучше S3/R2 + CDN + HLS и короткоживущие подписанные URL.
- Добавь лимиты, антивирус/проверки файлов, нормальную обложку/метаданные, мониторинг.
