import { Codex, type Thread, type ThreadEvent } from "@openai/codex-sdk";
import { nanoid } from "nanoid";
import type { EventBus } from "../events/eventBus";
import type { GitManager } from "./gitManager";
import type { SessionManager } from "./sessionManager";
import type { CodexMessage, CodexThreadRecord, ComposerMention, Session } from "../shared/types";
import type { CodexHistoryStore } from "./codex/historyStore";
import { consumeCodexEvents, createAssistantMessage } from "./codex/events";
import { validateCodexMentions } from "./codex/mentions";
import { buildCodexPrompt } from "./codex/prompt";

type RunningTurn = {
  controller: AbortController;
};

export class CodexManager {
  private codex = new Codex();
  private messages = new Map<string, CodexMessage[]>();
  private running = new Map<string, RunningTurn>();
  private threads = new Map<string, Thread>();
  private cancelled = new Set<string>();
  private deleted = new Set<string>();

  constructor(
    private events: EventBus,
    private git: GitManager,
    private sessions: SessionManager,
    private history: CodexHistoryStore,
  ) {}

  async hydrate(sessions: Session[]) {
    this.messages = await this.history.hydrate(sessions);
  }

  async listThreads(session: Session) {
    const threads = await this.history.ensureDefaultThread(session);
    const activeThread = this.activeThreadFrom(session, threads);
    if (session.activeCodexThreadId !== activeThread.id) await this.sessions.update(session.id, { activeCodexThreadId: activeThread.id });
    return { threads, activeThreadId: activeThread.id };
  }

  async createThread(session: Session, title?: string) {
    const thread = await this.history.createThread(session.id, title);
    await this.sessions.update(session.id, { activeCodexThreadId: thread.id, codexThreadId: undefined });
    return thread;
  }

  async selectThread(session: Session, threadId: string) {
    const threads = await this.history.ensureDefaultThread(session);
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) throw new Error("Codex thread not found");
    await this.sessions.update(session.id, { activeCodexThreadId: thread.id, codexThreadId: thread.codexThreadId });
    return thread;
  }

  async listMessages(session: Session) {
    const thread = await this.activeThread(session);
    return this.messages.get(thread.id) ?? [];
  }

  async resume(session: Session) {
    const thread = await this.activeThread(session);
    return {
      running: this.running.has(session.id),
      messages: this.messages.get(thread.id) ?? [],
      thread,
    };
  }

  async run(session: Session, input: { prompt: string; mentions: ComposerMention[] }) {
    if (this.running.has(session.id)) throw new Error("Codex is already running for this session");
    await validateCodexMentions(session.cwd, input.mentions);
    const activeThread = await this.activeThread(session);

    const prompt = buildCodexPrompt(input.prompt, input.mentions);
    await this.append(session.id, activeThread.id, { id: nanoid(), role: "user", text: input.prompt, createdAt: Date.now() });
    const thread = this.threadFor(session, activeThread);
    const controller = new AbortController();
    this.running.set(session.id, { controller });
    await this.sessions.update(session.id, { status: "running" });
    let events: AsyncGenerator<ThreadEvent>;
    try {
      events = (await thread.runStreamed(prompt, { signal: controller.signal })).events;
    } catch (error) {
      this.running.delete(session.id);
      await this.sessions.update(session.id, { status: "error" });
      throw error;
    }
    void consumeCodexEvents({
      events: this.events,
      eventStream: events,
      git: this.git,
      isDeleted: () => this.deleted.has(session.id),
      markNotRunning: () => this.running.delete(session.id),
      markCancelled: () => this.cancelled.delete(session.id),
      session,
      sessions: this.sessions,
      thread,
      appendAssistantMessage: (text) => this.append(session.id, activeThread.id, createAssistantMessage(text)),
      updateThreadId: async (codexThreadId) => {
        activeThread.codexThreadId = codexThreadId;
        activeThread.lastActiveAt = Date.now();
        await this.history.updateThread(activeThread);
        await this.sessions.update(session.id, { activeCodexThreadId: activeThread.id, codexThreadId });
      },
    });

    return { running: true, threadId: activeThread.id, codexThreadId: thread.id ?? activeThread.codexThreadId };
  }

  cancel(sessionId: string) {
    const turn = this.running.get(sessionId);
    if (!turn) return { running: false };
    this.cancelled.add(sessionId);
    turn.controller.abort();
    this.running.delete(sessionId);
    return { running: false };
  }

  async deleteSession(sessionId: string) {
    this.deleted.add(sessionId);
    this.cancel(sessionId);
    for (const thread of await this.history.listThreads(sessionId)) {
      this.messages.delete(thread.id);
      this.threads.delete(thread.id);
    }
    this.cancelled.delete(sessionId);
    await this.history.delete(sessionId);
  }

  private async append(sessionId: string, threadId: string, message: CodexMessage) {
    if (this.deleted.has(sessionId)) return;
    const messages = this.messages.get(threadId) ?? [];
    const next = [...messages, message].slice(-200);
    this.messages.set(threadId, next);
    await this.history.save(threadId, next);
    this.events.publish(sessionId, { type: "codex.event", payload: { message } });
  }

  private threadFor(session: Session, threadRecord: CodexThreadRecord) {
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

  private async activeThread(session: Session) {
    const threads = await this.history.ensureDefaultThread(session);
    const thread = this.activeThreadFrom(session, threads);
    if (session.activeCodexThreadId !== thread.id) await this.sessions.update(session.id, { activeCodexThreadId: thread.id, codexThreadId: thread.codexThreadId });
    return thread;
  }

  private activeThreadFrom(session: Session, threads: CodexThreadRecord[]) {
    return threads.find((thread) => thread.id === session.activeCodexThreadId) ?? threads[0];
  }
}
