import type { ThreadEvent } from "@openai/codex-sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { EventBus } from "@backend/events/eventBus";
import type { GitManager } from "@backend/managers/gitManager";
import type { SessionManager } from "@backend/managers/sessionManager";
import type { SkillManager } from "@backend/managers/skillManager";
import type { CodexMessage, CodexSlashCommandResult, CodexStatusSnapshot, ComposerMention, Session } from "@backend/shared/types";
import type { CodexHistoryStore } from "@backend/managers/codex/historyStore";
import { consumeCodexEvents, createAssistantMessage } from "@backend/managers/codex/events";
import { buildCodexMentionContext, validateCodexMentions } from "@backend/managers/codex/mentions";
import { buildCodexPrompt } from "@backend/managers/codex/prompt";
import { CODEX_SLASH_COMMANDS, findCodexSlashCommand, normalizeSlashCommand } from "@backend/managers/codex/slashCommands";
import { CodexThreadManager } from "@backend/managers/codex/threads";
import { codexThreadOptionsFromConfig, loadCodexCliConfig } from "@backend/managers/codex/config";

type RunningTurn = {
  controller: AbortController;
};

export class CodexManager {
  private messages = new Map<string, CodexMessage[]>();
  private running = new Map<string, RunningTurn>();
  private cancelled = new Set<string>();
  private deleted = new Set<string>();
  private usage = new Map<string, CodexStatusSnapshot["usage"]>();
  private threadManager: CodexThreadManager;

  constructor(
    private events: EventBus,
    private git: GitManager,
    private sessions: SessionManager,
    private skills: SkillManager,
    private history: CodexHistoryStore,
  ) {
    this.threadManager = new CodexThreadManager(sessions, history);
  }

  async hydrate(sessions: Session[]) {
    this.messages = await this.history.hydrate(sessions);
    await Promise.all(sessions.filter((session) => session.status === "running").map((session) => this.sessions.update(session.id, { status: "idle" }).catch(() => undefined)));
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

  async deleteThread(session: Session, threadId: string) {
    if (this.running.has(session.id)) throw new Error("Cannot delete a thread while Codex is running");
    const result = await this.threadManager.delete(session, threadId);
    this.messages.delete(threadId);
    return result;
  }

  async listMessages(session: Session) {
    const thread = await this.threadManager.current(session);
    if (!thread) return [];
    return visibleMessages(this.messages.get(thread.id) ?? []);
  }

  async resume(session: Session) {
    const thread = await this.threadManager.current(session);
    return {
      running: this.running.has(session.id),
      messages: thread ? visibleMessages(this.messages.get(thread.id) ?? []) : [],
      thread,
    };
  }

  async status(session: Session): Promise<CodexStatusSnapshot> {
    const thread = await this.threadManager.current(session);
    const cliConfig = loadCodexCliConfig();
    const threadOptions = codexThreadOptionsFromConfig(cliConfig);
    return {
      session: {
        id: session.id,
        name: session.name,
        cwd: session.cwd,
        status: session.status,
      },
      thread,
      model: {
        label: threadOptions.model || "Codex SDK default",
        source: process.env.CODEX_MODEL ? "CODEX_MODEL" : cliConfig.model ? "Codex CLI config" : "runtime default",
      },
      permissions: {
        sandbox: threadOptions.sandboxMode ?? "workspace-write",
        approvals: threadOptions.approvalPolicy ?? "on-request",
      },
      git: await this.git.state(session.cwd),
      usage: this.usage.get(session.id) ?? { note: "Token usage appears after Codex emits usage events for this session." },
      commands: {
        supported: CODEX_SLASH_COMMANDS.length,
        source: "OpenAI Codex TUI 0.129.0 slash command registry",
      },
    };
  }

  async slashCommands() {
    return CODEX_SLASH_COMMANDS;
  }

  async runSlashCommand(session: Session, input: { command: string; args?: string; options?: Record<string, unknown> }): Promise<CodexSlashCommandResult> {
    const command = normalizeSlashCommand(input.command);
    const definition = findCodexSlashCommand(command);
    if (!definition) throw new Error(`Unsupported Codex slash command: /${command}`);
    const args = input.args?.trim() || "";
    const options = input.options ?? {};

    if (command === "status") {
      return { command, handled: true, status: await this.status(session) };
    }
    if (command === "mention") return { command, handled: true, draft: "@" };

    if (command === "new") {
      const thread = await this.createThread(session, "New thread");
      await this.append(session.id, thread.id, systemMessage("Started a new Codex thread."));
      return { command, handled: true, message: "Started a new Codex thread." };
    }
    if (command === "fork") {
      const current = await this.threadManager.active(session);
      const previous = this.messages.get(current.id) ?? (await this.history.list(current.id));
      const thread = await this.threadManager.forkActive(session);
      if (previous.length > 0) {
        await this.history.save(thread.id, previous);
        this.messages.set(thread.id, previous);
      }
      await this.append(session.id, thread.id, systemMessage("Forked the current Codex thread."));
      return { command, handled: true, message: "Forked the current Codex thread." };
    }
    if (command === "rename") {
      const title = stringOption(options, "title") || args;
      if (!title.trim()) return { command, handled: false, message: "Thread name is required." };
      const thread = await this.threadManager.renameActive(session, title);
      await this.append(session.id, thread.id, systemMessage(`Renamed the current thread to "${thread.title}".`));
      return { command, handled: true, message: `Renamed the current thread to "${thread.title}".` };
    }
    if (command === "clear") {
      const thread = await this.threadManager.active(session);
      this.messages.set(thread.id, []);
      await this.history.save(thread.id, []);
      return { command, handled: true, message: "Cleared the current Codex thread transcript." };
    }
    if (command === "init") {
      const created = await ensureRuntimeAgentsFile(session.cwd);
      const message = created ? "Created AGENTS.md with Codex Web runtime policy." : "AGENTS.md already exists; left it unchanged.";
      await this.append(session.id, (await this.threadManager.active(session)).id, systemMessage(message));
      return { command, handled: true, message };
    }
    if (command === "diff") {
      const [staged, unstaged] = await Promise.all([this.git.diff(session.cwd, undefined, true), this.git.diff(session.cwd)]);
      const text = [staged ? "Staged diff:\n" + staged : "", unstaged ? "Unstaged diff:\n" + unstaged : ""].filter(Boolean).join("\n\n") || "No git diff available.";
      await this.append(session.id, (await this.threadManager.active(session)).id, createAssistantMessage(text));
      return { command, handled: true, message: "Added git diff to the Codex transcript." };
    }
    if (command === "compact") {
      return this.runPromptSlash(session, command, "Summarize the conversation so far, preserve key decisions and open tasks, and keep the next steps concise.");
    }
    if (command === "review") {
      return this.runPromptSlash(session, command, args || "Review my current changes and find correctness, security, regression, and missing-test issues.");
    }
    if (command === "plan") {
      return this.runPromptSlash(session, command, args || "Switch to planning mode for the next task. Ask only for missing constraints that block implementation.");
    }
    if (command === "goal") {
      const message = args ? `Goal set for this Codex thread: ${args}` : "Open the goal modal to set, pause, resume, or clear a long-running objective.";
      await this.append(session.id, (await this.threadManager.active(session)).id, systemMessage(message));
      return { command, handled: true, message };
    }
    if (command === "side") {
      return this.runPromptSlash(session, command, args || "Start a side analysis for the current topic and keep it separate from the main implementation path.");
    }

    const message = nativeCommandMessage(command, options, args);
    return { command, handled: true, message };
  }

  async run(session: Session, input: { prompt: string; mentions: ComposerMention[] }) {
    if (this.running.has(session.id)) throw new Error("Codex is already running for this session");
    await validateCodexMentions(session.cwd, input.mentions);
    const activeThread = await this.threadManager.active(session);

    const mentionContext = await buildCodexMentionContext(session.cwd, input.mentions, (id) => this.skills.read(session.cwd, id));
    const prompt = buildCodexPrompt(input.prompt, input.mentions, mentionContext);
    await this.append(session.id, activeThread.id, { id: nanoid(), role: "user", text: input.prompt, createdAt: Date.now() });
    const thread = this.threadManager.sdkThreadFor(session, activeThread);
    const controller = new AbortController();
    this.running.set(session.id, { controller });
    await this.sessions.update(session.id, { status: "running" });
    void this.consumeRunStream(session, activeThread.id, activeThread, thread, prompt, controller);

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

  private async consumeRunStream(
    session: Session,
    threadId: string,
    activeThread: Awaited<ReturnType<CodexThreadManager["active"]>>,
    thread: ReturnType<CodexThreadManager["sdkThreadFor"]>,
    prompt: string,
    controller: AbortController,
  ) {
    let eventStream: AsyncGenerator<ThreadEvent>;
    try {
      eventStream = (await thread.runStreamed(prompt, { signal: controller.signal })).events;
    } catch (error) {
      await this.handleRunStartFailure(session, threadId, error);
      return;
    }

    await consumeCodexEvents({
      events: this.events,
      eventStream,
      git: this.git,
      isDeleted: () => this.deleted.has(session.id),
      markNotRunning: () => this.running.delete(session.id),
      markCancelled: () => this.cancelled.delete(session.id),
      session,
      sessions: this.sessions,
      thread,
      appendAssistantMessage: (text) => this.append(session.id, threadId, createAssistantMessage(text)),
      recordUsage: (usage) => {
        this.usage.set(session.id, usage);
      },
      updateThreadId: (codexThreadId) => this.threadManager.updateCodexThreadId(session, activeThread, codexThreadId),
    });
  }

  private async handleRunStartFailure(session: Session, threadId: string, error: unknown) {
    this.running.delete(session.id);
    const cancelled = this.cancelled.delete(session.id);
    if (this.deleted.has(session.id)) return;
    const message = cancelled ? "Codex run cancelled." : error instanceof Error ? error.message : "Codex run failed to start.";
    await this.append(session.id, threadId, createAssistantMessage(message));
    await this.sessions.update(session.id, { status: cancelled ? "idle" : "error" });
    if (!cancelled) {
      this.events.publish(session.id, {
        type: "codex.event",
        payload: { type: "turn.failed", error: { message } },
      });
    }
  }

  private async runPromptSlash(session: Session, command: string, prompt: string): Promise<CodexSlashCommandResult> {
    await this.run(session, { prompt, mentions: [] });
    return { command, handled: true, message: `Started /${command}.` };
  }
}

function systemMessage(text: string): CodexMessage {
  return { id: nanoid(), role: "system", text, createdAt: Date.now() };
}

function visibleMessages(messages: CodexMessage[]) {
  return messages.filter((message) => !isNativeCommandNotice(message));
}

function isNativeCommandNotice(message: CodexMessage) {
  return message.role === "system" && /^(Applied|Handled) \/[a-z0-9-]+ through the Codex Web native command surface\./.test(message.text);
}

function stringOption(options: Record<string, unknown>, key: string) {
  const value = options[key];
  return typeof value === "string" ? value : "";
}

async function ensureRuntimeAgentsFile(cwd: string) {
  const file = path.join(cwd, "AGENTS.md");
  const content = `# Codex Web Runtime Policy

This project is managed by Codex Web.

Do not run long-running commands directly.
Use \`cw job <command...>\`, \`cw preview <command...>\`, and \`cw service <command...>\` so the UI can track work.
`;
  try {
    await fs.writeFile(file, content, { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

function nativeCommandMessage(command: string, options: Record<string, unknown>, args: string) {
  const changed = args || Object.values(options).some((value) => value !== undefined && value !== "");
  return changed ? `Applied /${command}.` : `Handled /${command}.`;
}
