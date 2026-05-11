import { SecretsStore } from "../auth/secretsStore";
import { TelegramClient } from "../auth/telegramClient";
import { JsonStore } from "../managers/storage";
import { WorkspaceManager } from "../managers/workspaceManager";
import { formatStartupTelegramMessage, type StartupAccessInfo } from "./startupAccess";

export async function sendStartupAccessTelegram(access: StartupAccessInfo) {
  const store = new JsonStore();
  await store.ensure();
  const settings = await new WorkspaceManager(store).getSettings();
  const secrets = await new SecretsStore(store).read();
  const botToken = process.env.CW_TELEGRAM_BOT_TOKEN || secrets.telegram?.botToken;
  const chatId = settings.telegram?.allowedChatId;
  if (!botToken || !chatId) throw new Error("Telegram auth is not configured. Run: cw config telegram");
  await new TelegramClient(botToken).sendMessage({
    chatId,
    text: formatStartupTelegramMessage(access, true),
  });
}
