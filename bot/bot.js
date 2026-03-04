import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN missing');
if (!WEBAPP_URL) throw new Error('WEBAPP_URL missing');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/(start|app)/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Открой Mini App:', {
    reply_markup: {
      inline_keyboard: [[{ text: '🎵 Open Music App', web_app: { url: WEBAPP_URL } }]]
    }
  });
});

bot.on('message', (msg) => {
  if (msg.web_app_data?.data) {
    bot.sendMessage(msg.chat.id, `Получил из Mini App: ${msg.web_app_data.data}`);
  }
});

console.log('Bot running');
