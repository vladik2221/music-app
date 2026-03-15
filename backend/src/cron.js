import { prisma } from './prisma.js';
import { sendTrialExpiringSoon } from './bot.js';

// Запускается каждый час, проверяет у кого триал заканчивается завтра
export async function startCron() {
  console.log('⏰ Cron started');
  // Первый запуск сразу
  await checkTrialExpiring();
  // Затем каждый час
  setInterval(checkTrialExpiring, 60 * 60 * 1000);
}

async function checkTrialExpiring() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Ищем пользователей у кого триал заканчивается через ~24 часа
    // и у кого нет активной платной подписки
    // и кому ещё не отправляли напоминание (reminderSentAt null)
    const users = await prisma.user.findMany({
      where: {
        trialEndsAt: { gte: in24h, lte: in25h },
        accessEndsAt: null,
        reminderSentAt: null,
      }
    });

    for (const user of users) {
      try {
        await sendTrialExpiringSoon(user.telegramId, user.firstName);
        // Отмечаем что напоминание отправлено
        await prisma.user.update({
          where: { id: user.id },
          data: { reminderSentAt: new Date() }
        });
        console.log(`Reminder sent to ${user.telegramId}`);
      } catch (e) {
        console.error(`Failed to send reminder to ${user.telegramId}:`, e.message);
      }
    }
  } catch (e) {
    console.error('Cron error:', e.message);
  }
}
