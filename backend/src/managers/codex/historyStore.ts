import type { CodexMessage, Session } from "../../shared/types";
import type { JsonStore } from "../storage";

export class CodexHistoryStore {
  constructor(private store: JsonStore) {}

  async hydrate(sessions: Session[]) {
    const entries = await Promise.all(sessions.map(async (session) => [session.id, await this.list(session.id)] as const));
    return new Map(entries.filter(([, messages]) => messages.length > 0));
  }

  async list(sessionId: string) {
    return this.store.read<CodexMessage[]>(this.fileName(sessionId), []);
  }

  async save(sessionId: string, messages: CodexMessage[]) {
    await this.store.write(this.fileName(sessionId), messages.slice(-200));
  }

  async delete(sessionId: string) {
    await this.store.delete(this.fileName(sessionId));
  }

  private fileName(sessionId: string) {
    return `codex/${sessionId}.json`;
  }
}
