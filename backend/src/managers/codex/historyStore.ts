import { nanoid } from "nanoid";
import type { CodexMessage, CodexThreadRecord, Session } from "../../shared/types";
import type { JsonStore } from "../storage";

export class CodexHistoryStore {
  constructor(private store: JsonStore) {}

  async hydrate(sessions: Session[]) {
    const threads = (await Promise.all(sessions.map((session) => this.ensureDefaultThread(session)))).flat();
    const entries = await Promise.all(threads.map(async (thread) => [thread.id, await this.list(thread.id)] as const));
    return new Map(entries.filter(([, messages]) => messages.length > 0));
  }

  async list(threadId: string) {
    return this.store.read<CodexMessage[]>(this.messageFileName(threadId), []);
  }

  async save(threadId: string, messages: CodexMessage[]) {
    await this.store.write(this.messageFileName(threadId), messages.slice(-200));
  }

  async delete(sessionId: string) {
    const threads = await this.listThreads(sessionId);
    await Promise.all(threads.map((thread) => this.store.delete(this.messageFileName(thread.id))));
    await Promise.all([this.store.delete(this.threadsFileName(sessionId)), this.store.delete(this.legacyMessageFileName(sessionId))]);
  }

  async listThreads(sessionId: string) {
    return this.store.read<CodexThreadRecord[]>(this.threadsFileName(sessionId), []);
  }

  async ensureDefaultThread(session: Session) {
    const threads = await this.listThreads(session.id);
    if (threads.length > 0) return threads;
    const now = Date.now();
    const thread: CodexThreadRecord = {
      id: nanoid(),
      sessionId: session.id,
      title: "Main",
      codexThreadId: session.codexThreadId,
      createdAt: now,
      lastActiveAt: now,
    };
    const legacyMessages = await this.store.read<CodexMessage[]>(this.legacyMessageFileName(session.id), []);
    if (legacyMessages.length > 0) await this.save(thread.id, legacyMessages);
    await this.saveThreads(session.id, [thread]);
    return [thread];
  }

  async createThread(sessionId: string, title?: string) {
    const now = Date.now();
    const threads = await this.listThreads(sessionId);
    const thread: CodexThreadRecord = {
      id: nanoid(),
      sessionId,
      title: title?.trim() || `Thread ${threads.length + 1}`,
      createdAt: now,
      lastActiveAt: now,
    };
    await this.saveThreads(sessionId, [thread, ...threads]);
    return thread;
  }

  async updateThread(thread: CodexThreadRecord) {
    const threads = await this.listThreads(thread.sessionId);
    await this.saveThreads(
      thread.sessionId,
      threads.map((item) => (item.id === thread.id ? thread : item)),
    );
    return thread;
  }

  private async saveThreads(sessionId: string, threads: CodexThreadRecord[]) {
    await this.store.write(this.threadsFileName(sessionId), threads);
  }

  private threadsFileName(sessionId: string) {
    return `codex/${sessionId}.threads.json`;
  }

  private messageFileName(threadId: string) {
    return `codex/${threadId}.json`;
  }

  private legacyMessageFileName(sessionId: string) {
    return `codex/${sessionId}.json`;
  }
}
