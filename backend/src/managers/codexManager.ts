import type { ThreadEvent } from "@openai/codex-sdk";
import { nanoid } from "nanoid";
import type { EventBus } from "../events/eventBus";
import type { GitManager } from "./gitManager";
import type { SessionManager } from "./sessionManager";
import type { CodexMessage, ComposerMention, Session } from "../shared/types";
import type { CodexHistoryStore } from "./codex/historyStore";
import { consumeCodexEvents, createAssistantMessage } from "./codex/events";
import { buildCodexMentionContext, validateCodexMentions } from "./codex/mentions";
import { buildCodexPrompt } from "./codex/prompt";
import { CodexThreadManager } from "./codex/threads";

type RunningTurn = {
  controller: AbortController;
};

export class CodexManager {
  private messages = new Map<string, CodexMessage[]>();
  private running = new Map<string, RunningTurn>();
  private cancelled = new Set<string>();
  private deleted = new Set<string>();
  private threadManager: CodexThreadManager;

  constructor(
    private events: EventBus,
    private git: GitManager,
    private sessions: SessionManager,
    private history: CodexHistoryStore,
  ) {
    this.threadManager = new CodexThreadManager(sessions, history);
  }

  async hydrate(sessions: Session[]) {
    this.messages = await this.history.hydrate(sessions);
  }

  async listThreads(session: Session) {
    return this.threadManager.list(session);
  }

  async createThread(session: Session, title?: string) {
    return this.threadManager.create(session, title);
  }

  async selectThread(session: Session, threadId: string) {
    return this.threadManager.select(session, threadId);
  }

  async listMessages(session: Session) {
    const thread = await this.threadManager.active(session);
    return this.messages.get(thread.id) ?? [];
  }

  async resume(session: Session) {
    const thread = await this.threadManager.active(session);
    return {
      running: this.running.has(session.id),
      messages: this.messages.get(thread.id) ?? [],
      thread,
    };
  }

  async run(session: Session, input: { prompt: string; mentions: ComposerMention[] }) {
    if (this.running.has(session.id)) throw new Error("Codex is already running for this session");
    await validateCodexMentions(session.cwd, input.mentions);
    const activeThread = await this.threadManager.active(session);

    const mentionContext = await buildCodexMentionContext(session.cwd, input.mentions);
    const prompt = buildCodexPrompt(input.prompt, input.mentions, mentionContext);
    await this.append(session.id, activeThread.id, { id: nanoid(), role: "user", text: input.prompt, createdAt: Date.now() });
    const thread = this.threadManager.sdkThreadFor(session, activeThread);
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
      updateThreadId: (codexThreadId) => this.threadManager.updateCodexThreadId(session, activeThread, codexThreadId),
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
    }
    await this.threadManager.deleteSession(sessionId);
    this.cancelled.delete(sessionId);
    await this.history.delete(sessionId);
  }

  async shutdown() {
    const sessionIds = [...this.running.keys()];
    for (const sessionId of sessionIds) this.cancel(sessionId);
    await Promise.all(sessionIds.map((sessionId) => this.sessions.update(sessionId, { status: "idle" }).catch(() => undefined)));
  }

  private async append(sessionId: string, threadId: string, message: CodexMessage) {
    if (this.deleted.has(sessionId)) return;
    const messages = this.messages.get(threadId) ?? [];
    const next = [...messages, message].slice(-200);
    this.messages.set(threadId, next);
    await this.history.save(threadId, next);
    this.events.publish(sessionId, { type: "codex.event", payload: { message } });
  }
}
