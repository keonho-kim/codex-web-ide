export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat: { id: number };
    from?: TelegramUser;
  };
  callback_query?: {
    id: string;
    data?: string;
    from: TelegramUser;
    message?: {
      chat: { id: number };
      message_id: number;
    };
  };
};

export class TelegramClient {
  constructor(private token: string, private apiBase = process.env.CW_TELEGRAM_API_BASE || "https://api.telegram.org") {}

  async getMe() {
    return this.call<{ id: number; username?: string; first_name?: string }>("getMe", {});
  }

  async getUpdates(offset?: number) {
    return this.call<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: 20,
      allowed_updates: ["message", "callback_query"],
    });
  }

  async sendMessage(input: { chatId: number; text: string; replyMarkup?: unknown }) {
    return this.call("sendMessage", {
      chat_id: input.chatId,
      text: input.text,
      reply_markup: input.replyMarkup,
    });
  }

  async answerCallbackQuery(input: { callbackQueryId: string; text?: string }) {
    return this.call("answerCallbackQuery", {
      callback_query_id: input.callbackQueryId,
      text: input.text,
    });
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.apiBase}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
    return payload.result as T;
  }
}

export function telegramDisplayName(user?: TelegramUser) {
  if (!user) return undefined;
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || String(user.id);
}
