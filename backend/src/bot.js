export async function handleUpdate(update) {
  console.log('Handling update type:', Object.keys(update).join(','));
  
import { prisma } from './prisma.js';
import { addDays, isAccessActive, now } from './utils.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PROVIDER_TOKEN = process.env.TELEGRAM_PAYMENT_TOKEN; // токен провайдера из ЮКасса
const MINI_APP_URL = process.env.FRONTEND_URL || 'https://24musiccloud.ru';
const SUBSCRIPTION_PRICE = Number(process.env.SUBSCRIPTION_PRICE_RUB || 110);
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);

const API = `https://api.telegram.org/bot${TOKEN}`;

async function tgRequest(method, body) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

// ── Отправка приветствия при /start ────────────────────────────────────────
export async function sendWelcome(chatId, firstName) {
  await tgRequest('sendMessage', {
    chat_id: chatId,
    text:
      `👋 Привет, ${firstName || 'друг'}!\n\n` +
      `🎧 <b>MusicCloud</b> — слушай музыку без ограничений.\n\n` +
      `✅ Пробный период — <b>${TRIAL_DAYS} дней бесплатно</b>\n` +
      `💳 Затем — <b>${SUBSCRIPTION_PRICE} ₽/месяц</b>\n\n` +
      `Нажми кнопку ниже чтобы начать:`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎵 Открыть MusicCloud', web_app: { url: MINI_APP_URL } }],
        [{ text: '🆓 Попробовать бесплатно (14 дней)', callback_data: 'start_trial' }],
        [{ text: '💳 Купить подписку', callback_data: 'buy_subscription' }],
      ]
    }
  });
}

// ── Отправка invoice для оплаты ────────────────────────────────────────────
export async function sendPaymentInvoice(chatId) {
  await tgRequest('sendInvoice', {
    chat_id: chatId,
    title: 'Подписка MusicCloud',
    description: `Доступ ко всей музыке на 30 дней — ${SUBSCRIPTION_PRICE} ₽`,
    payload: `subscription_${chatId}_${Date.now()}`,
    provider_token: PROVIDER_TOKEN,
    currency: 'RUB',
    prices: [{ label: 'Подписка на 30 дней', amount: SUBSCRIPTION_PRICE * 100 }],
    reply_markup: {
      inline_keyboard: [[{ text: `💳 Оплатить ${SUBSCRIPTION_PRICE} ₽`, pay: true }]]
    }
  });
}

// ── Напоминание об истечении триала ───────────────────────────────────────
export async function sendTrialExpiringSoon(chatId, firstName) {
  await tgRequest('sendMessage', {
    chat_id: chatId,
    text:
      `⏰ ${firstName || 'Привет'}! Твой пробный период заканчивается завтра.\n\n` +
      `Чтобы продолжить слушать музыку — оформи подписку за <b>${SUBSCRIPTION_PRICE} ₽/месяц</b>:`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: `💳 Купить подписку — ${SUBSCRIPTION_PRICE} ₽`, callback_data: 'buy_subscription' }],
        [{ text: '🎵 Открыть приложение', web_app: { url: MINI_APP_URL } }],
      ]
    }
  });
}

// ── Обработка входящих апдейтов от Telegram ───────────────────────────────
export async function handleUpdate(update) {
  // Обычное сообщение или команда /start
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name;
    const text = msg.text || '';

  if (text.startsWith('/start')) {
    console.log('Sending welcome to', chatId);
    try {
      await sendWelcome(chatId, firstName);
      console.log('Welcome sent OK');
    } catch(e) {
      console.error('Welcome error:', e.message);
    }
  return;
  }
  }

  // Нажатие на inline кнопку
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const telegramId = String(cb.from.id);
    const firstName = cb.from.first_name;

    // Подтверждаем получение callback
    await tgRequest('answerCallbackQuery', { callback_query_id: cb.id });

    if (cb.data === 'start_trial') {
      // Активируем триал в БД
      const user = await prisma.user.findFirst({ where: { telegramId } });
      if (!user) {
        await tgRequest('sendMessage', {
          chat_id: chatId,
          text: '❌ Сначала открой приложение через кнопку выше, чтобы зарегистрироваться.'
        });
        return;
      }
      if (user.trialStartedAt) {
        await tgRequest('sendMessage', {
          chat_id: chatId,
          text: `ℹ️ Ты уже использовал пробный период. Оформи подписку чтобы продолжить.`,
          reply_markup: {
            inline_keyboard: [[{ text: `💳 Купить — ${SUBSCRIPTION_PRICE} ₽`, callback_data: 'buy_subscription' }]]
          }
        });
        return;
      }
      const trialStartedAt = now();
      const trialEndsAt = addDays(trialStartedAt, TRIAL_DAYS);
      await prisma.user.update({
        where: { telegramId },
        data: { trialStartedAt, trialEndsAt }
      });
      await tgRequest('sendMessage', {
        chat_id: chatId,
        text:
          `✅ Пробный период активирован на <b>${TRIAL_DAYS} дней</b>!\n\n` +
          `Открывай приложение и слушай музыку:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🎵 Открыть MusicCloud', web_app: { url: MINI_APP_URL } }]]
        }
      });
      return;
    }

    if (cb.data === 'buy_subscription') {
      await sendPaymentInvoice(chatId);
      return;
    }
  }

  // Подтверждение платежа (pre_checkout_query) — обязательно нужно ответить
  if (update.pre_checkout_query) {
    await tgRequest('answerPreCheckoutQuery', {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true
    });
    return;
  }

  // Успешный платёж
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const chatId = update.message.chat.id;
    const telegramId = String(update.message.from.id);
    const firstName = update.message.from.first_name;

    // Активируем подписку на 30 дней
    const accessEndsAt = addDays(now(), 30);
    await prisma.user.update({
      where: { telegramId },
      data: { accessEndsAt }
    });

    await tgRequest('sendMessage', {
      chat_id: chatId,
      text:
        `🎉 Спасибо, ${firstName}! Оплата прошла успешно.\n\n` +
        `✅ Подписка активна на <b>30 дней</b>.\n` +
        `Открывай приложение и наслаждайся музыкой:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🎵 Открыть MusicCloud', web_app: { url: MINI_APP_URL } }]]
      }
    });
  }
}

// ── Polling (получаем апдейты каждые 2 сек) ───────────────────────────────
let pollingOffset = 0;

export async function startPolling() {
  console.log('🤖 Bot polling started');
  while (true) {
    try {
      const res = await fetch(`${API}/getUpdates?offset=${pollingOffset}&timeout=25`);
      const data = await res.json();
      if (data.ok && data.result?.length) {
        console.log('Got updates:', JSON.stringify(data.result));
        for (const update of data.result) {
          pollingOffset = update.update_id + 1;
          handleUpdate(update).catch(e => console.error('Bot update error:', e));
        }
      }
    } catch (e) {
      console.error('Polling error:', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
    await new Promise(r => setTimeout(r, 500));
  }
}
