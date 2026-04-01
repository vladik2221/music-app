import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import router from './routes.js';
import { startPolling } from './bot.js';
import { startCron } from './cron.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use(router);

// Global error handler — catches errors forwarded via next(err)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  // Запускаем бота и крон только если токен задан
  if (process.env.TELEGRAM_BOT_TOKEN) {
    startPolling().catch(e => console.error('Bot error:', e));
    startCron().catch(e => console.error('Cron error:', e));
  }
});
