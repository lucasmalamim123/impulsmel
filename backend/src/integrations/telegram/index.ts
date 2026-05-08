import axios from 'axios';
import { getTenantConfigValue } from '../../domains/tenants/tenant.service';

async function getTelegramConfig(tenantId?: string) {
  const [botToken, alertChatId] = tenantId
    ? await Promise.all([
        getTenantConfigValue(tenantId, 'telegram.bot_token'),
        getTenantConfigValue(tenantId, 'telegram.alert_chat_id'),
      ])
    : [undefined, undefined];

  return {
    botToken: botToken ?? process.env.TELEGRAM_BOT_TOKEN,
    alertChatId: alertChatId ?? process.env.TELEGRAM_ALERT_CHAT_ID,
  };
}

export async function sendTelegramAlert(text: string, tenantId?: string): Promise<void> {
  const config = await getTelegramConfig(tenantId);
  if (!config.botToken || !config.alertChatId) return;

  await axios.post(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    chat_id: config.alertChatId,
    text,
    parse_mode: 'Markdown',
  });
}

export async function sendTelegramPhoto(caption: string, photo: string, tenantId?: string): Promise<void> {
  const config = await getTelegramConfig(tenantId);
  if (!config.botToken || !config.alertChatId) return;

  await axios.post(`https://api.telegram.org/bot${config.botToken}/sendPhoto`, {
    chat_id: config.alertChatId,
    photo,
    caption,
    parse_mode: 'Markdown',
  });
}

export async function testTelegramConnection(tenantId: string): Promise<{ ok: true; botUsername?: string; chatId: string }> {
  const config = await getTelegramConfig(tenantId);
  if (!config.botToken || !config.alertChatId) throw new Error('Telegram config is incomplete');

  const [botRes] = await Promise.all([
    axios.get(`https://api.telegram.org/bot${config.botToken}/getMe`),
    axios.get(`https://api.telegram.org/bot${config.botToken}/getChat`, {
      params: { chat_id: config.alertChatId },
    }),
  ]);

  return { ok: true, botUsername: botRes.data?.result?.username, chatId: config.alertChatId };
}
