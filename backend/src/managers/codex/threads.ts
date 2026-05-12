import { Codex, type Thread } from "@openai/codex-sdk";
import type { CodexThreadRecord, Session } from "@backend/shared/types";
import type { SessionManager } from "@backend/managers/sessionManager";
import type { CodexHistoryStore } from "@backend/managers/codex/historyStore";

export class CodexThreadManager {
  private codex = new Codex();
  private threads = new Map<string, Thread>();

  constructor(
    private sessions: SessionManager,
    private history: CodexHistoryStore,
  ) {}

  async list(session: Session) {
    const activeThread = await this.current(session);
    const threads = await this.history.listThreads(session.id);
    return { threads, activeThreadId: activeThread?.id ?? null };
  }

  async create(session: Session, title?: string) {
    const thread = await this.history.createThread(session.id, title);
    await this.sessions.update(session.id, { activeCodexThreadId: thread.id, codexThreadId: undefined });
    return thread;
  }

  async select(session: Session, threadId: string) {
    const threads = await this.history.listThreads(session.id);
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) throw new Error("Codex thread not found");
    await this.sessions.update(session.id, { activeCodexThreadId: thread.id, codexThreadId: thread.codexThreadId });
    return thread;
  }

  async renameActive(session: Session, title: string) {
    const thread = await this.active(session);
    const next = { ...thread, title: title.trim(), lastActiveAt: Date.now() };
    await this.history.updateThread(next);
    return next;
  }

  async forkActive(session: Session) {
    const current = await this.active(session);
    const fork = await this.history.createThread(session.id, `${current.title} fork`);
    await this.sessions.update(session.id, { activeCodexThreadId: fork.id, codexThreadId: undefined });
    return fork;
  }

  async delete(session: Session, threadId: string) {
    const result = await this.history.deleteThread(session, threadId);
    this.threads.delete(threadId);
    await this.sessions.update(session.id, {
      activeCodexThreadId: result.active?.id,
      codexThreadId: result.active?.codexThreadId,
    });
    return { threads: result.threads, activeThreadId: result.active?.id ?? null };
  }

  async current(session: Session) {
    const threads = await this.history.listThreads(session.id);
    const activeThread = threads.length > 0 ? this.activeThreadFrom(session, threads) : null;
    if (activeThread) await this.syncActiveSessionThread(session, activeThread);
    else if (session.activeCodexThreadId || session.codexThreadId) await this.sessions.update(session.id, { activeCodexThreadId: undefined, codexThreadId: undefined });
    return activeThread;
  }

  async active(session: Session) {
    const thread = await this.history.ensureActiveThread(session);
    await this.syncActiveSessionThread(session, thread);
    return thread;
  }

  sdkThreadFor(session: Session, threadRecord: CodexThreadRecord) {
    const existing = this.threads.get(threadRecord.id);
    if (existing) return existing;
    const options = {
      workingDirectory: session.cwd,
      sandboxMode: "workspace-write" as const,
      approvalPolicy: "on-request" as const,
      skipGitRepoCheck: true,
    };
    const thread = threadRecord.codexThreadId ? this.codex.resumeThread(threadRecord.codexThreadId, options) : this.codex.startThread(options);
    this.threads.set(threadRecord.id, thread);
    return thread;
  }

  async updateCodexThreadId(session: Session, threadRecord: CodexThreadRecord, codexThreadId: string) {
    threadRecord.codexThreadId = codexThreadId;
    threadRecord.lastActiveAt = Date.now();
    await this.history.updateThread(threadRecord);
    await this.sessions.update(session.id, { activeCodexThreadId: threadRecord.id, codexThreadId });
  }

  async deleteSession(sessionId: string) {
    for (const thread of await this.history.listThreads(sessionId)) {
      this.threads.delete(thread.id);
    }
  }

  private async syncActiveSessionThread(session: Session, thread: CodexThreadRecord) {
    if (session.activeCodexThreadId !== thread.id || session.codexThreadId !== thread.codexThreadId) {
      await this.sessions.update(session.id, { activeCodexThreadId: thread.id, codexThreadId: thread.codexThreadId });
    }
  }

  private activeThreadFrom(session: Session, threads: CodexThreadRecord[]) {
    return threads.find((thread) => thread.id === session.activeCodexThreadId) ?? threads[0];
  }
}
