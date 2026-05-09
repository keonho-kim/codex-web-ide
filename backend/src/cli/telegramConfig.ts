import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AuthManager } from "../auth/authManager";
import { TelegramClient, telegramDisplayName } from "../auth/telegramClient";
import { JsonStore } from "../managers/storage";
import { WorkspaceManager } from "../managers/workspaceManager";

export async function configureTelegram() {
  const terminal = createInterface({ input, output });
  try {
    const botToken = (await terminal.question("Telegram bot token: ")).trim();
    if (!botToken) throw new Error("Telegram bot token is required.");
    const client = new TelegramClient(botToken);
    const bot = await client.getMe();
    console.log(`Telegram bot verified: @${bot.username || bot.first_name || bot.id}`);
    console.log("Open Telegram and send /start to this bot.");
    console.log("Waiting for message...");
    const update = await waitForStart(client);
    const user = update.message?.from;
    const chatId = update.message?.chat.id;
    if (!user || !chatId) throw new Error("Telegram /start message did not include a user and chat.");
    console.log("");
    console.log("Received /start from:");
    console.log(`  Name: ${telegramDisplayName(user) || "-"}`);
    console.log(`  User ID: ${user.id}`);
    console.log(`  Chat ID: ${chatId}`);
    const answer = (await terminal.question("Use this Telegram account as Codex Web owner? [Y/n] ")).trim().toLowerCase();
    if (answer === "n" || answer === "no") throw new Error("Telegram configuration cancelled.");
    const store = new JsonStore();
    await store.ensure();
    const auth = new AuthManager(new WorkspaceManager(store), store);
    await auth.configureTelegram({
      botToken,
      allowedTelegramUserId: user.id,
      allowedChatId: chatId,
      ownerDisplayName: telegramDisplayName(user),
      botUsername: bot.username,
    });
    await client.sendMessage({ chatId, text: "Codex Web Telegram auth is configured." });
    console.log("Telegram auth configured.");
  } finally {
    terminal.close();
  }
}

async function waitForStart(client: TelegramClient) {
  let offset: number | undefined;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const updates = await client.getUpdates(offset);
    for (const update of updates) {
      offset = update.update_id + 1;
      if (update.message?.text?.trim() === "/start" && update.message.from) return update;
    }
  }
  throw new Error("Timed out waiting for Telegram /start.");
}
