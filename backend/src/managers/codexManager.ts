import { Codex, type Thread, type ThreadEvent } from "@openai/codex-sdk";
import { nanoid } from "nanoid";
import type { EventBus } from "../events/eventBus";
import type { GitManager } from "./gitManager";
import type { SessionManager } from "./sessionManager";
import { safePath } from "./fileManager";
import type { CodexMessage, ComposerMention, Session } from "../shared/types";
import type { CodexHistoryStore } from "./codex/historyStore";
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

  listMessages(sessionId: string) {
    return this.messages.get(sessionId) ?? [];
  }

  resume(sessionId: string) {
    return {
      running: this.running.has(sessionId),
      messages: this.listMessages(sessionId),
    };
  }

  async run(session: Session, input: { prompt: string; mentions: ComposerMention[] }) {
    if (this.running.has(session.id)) throw new Error("Codex is already running for this session");
    for (const mention of input.mentions) {
      if (mention.type === "file") safePath(session.cwd, mention.path);
    }

    const prompt = buildCodexPrompt(input.prompt, input.mentions);
    await this.append(session.id, { id: nanoid(), role: "user", text: input.prompt, createdAt: Date.now() });
    const thread = this.threadFor(session);
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
    void this.consumeEvents(session, thread, events);

    return { running: true, threadId: thread.id ?? session.codexThreadId };
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
    this.messages.delete(sessionId);
    this.threads.delete(sessionId);
    this.cancelled.delete(sessionId);
    await this.history.delete(sessionId);
  }

  private async append(sessionId: string, message: CodexMessage) {
    if (this.deleted.has(sessionId)) return;
    const messages = this.messages.get(sessionId) ?? [];
    const next = [...messages, message].slice(-200);
    this.messages.set(sessionId, next);
    await this.history.save(sessionId, next);
    this.events.publish(sessionId, { type: "codex.event", payload: { message } });
  }

  private threadFor(session: Session) {
    const existing = this.threads.get(session.id);
    if (existing) return existing;
    const options = {
      workingDirectory: session.cwd,
      sandboxMode: "workspace-write" as const,
      approvalPolicy: "on-request" as const,
      skipGitRepoCheck: true,
    };
    const thread = session.codexThreadId ? this.codex.resumeThread(session.codexThreadId, options) : this.codex.startThread(options);
    this.threads.set(session.id, thread);
    return thread;
  }

  private async consumeEvents(session: Session, thread: Thread, events: AsyncGenerator<ThreadEvent>) {
    const agentMessages = new Map<string, string>();
    let failure: string | undefined;
    let cancelled = false;
    try {
      for await (const event of events) {
        this.events.publish(session.id, { type: "codex.event", payload: event });
        if (event.type === "thread.started") {
          await this.sessions.update(session.id, { codexThreadId: event.thread_id });
        }
        if ((event.type === "item.updated" || event.type === "item.completed") && event.item.type === "agent_message") {
          agentMessages.set(event.item.id, event.item.text);
        }
        if (event.type === "turn.failed") {
          failure = event.error.message;
        }
        if (event.type === "error") {
          failure = event.message;
        }
      }
    } catch (error) {
      cancelled = this.cancelled.delete(session.id);
      if (!cancelled) failure = error instanceof Error ? error.message : "Codex run failed.";
    } finally {
      this.running.delete(session.id);
      if (this.deleted.has(session.id)) return;
      if (!cancelled) cancelled = this.cancelled.delete(session.id);
      if (thread.id) await this.sessions.update(session.id, { codexThreadId: thread.id });
      const text = [...agentMessages.values()].join("\n").trim();
      await this.append(session.id, {
        id: nanoid(),
        role: "assistant",
        text: text || failure || (cancelled ? "Codex run cancelled." : "Codex run finished without a response."),
        createdAt: Date.now(),
      });
      await this.sessions.update(session.id, { status: failure ? "error" : "idle" });
      try {
        this.events.publish(session.id, { type: "git.state.updated", state: await this.git.state(session.cwd) });
      } catch (error) {
        this.events.publish(session.id, { type: "codex.event", payload: { type: "git.refresh.failed", message: error instanceof Error ? error.message : "Git refresh failed." } });
      }
    }
  }
}
