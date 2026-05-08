import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { nanoid } from "nanoid";
import type { EventBus } from "../events/eventBus";
import type { GitManager } from "./gitManager";
import { safePath } from "./fileManager";
import type { CodexMessage, ComposerMention, Session } from "../shared/types";

export class CodexManager {
  private messages = new Map<string, CodexMessage[]>();
  private running = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(
    private events: EventBus,
    private git: GitManager,
  ) {}

  listMessages(sessionId: string) {
    return this.messages.get(sessionId) ?? [];
  }

  async run(session: Session, input: { prompt: string; mentions: ComposerMention[] }) {
    if (this.running.has(session.id)) throw new Error("Codex is already running for this session");
    for (const mention of input.mentions) {
      if (mention.type === "file") safePath(session.cwd, mention.path);
    }

    const prompt = buildPrompt(input.prompt, input.mentions);
    this.append(session.id, { id: nanoid(), role: "user", text: input.prompt, createdAt: Date.now() });
    const child = spawn(
      "codex",
      ["exec", "--json", "--cd", session.cwd, "--sandbox", "workspace-write", "--ask-for-approval", "on-request", "-"],
      { cwd: session.cwd, env: process.env, shell: false },
    );
    this.running.set(session.id, child);
    child.stdin.end(prompt);

    let assistantText = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      assistantText += extractCodexText(text);
      this.events.publish(session.id, { type: "codex.event", payload: { stream: "stdout", text } });
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.events.publish(session.id, { type: "codex.event", payload: { stream: "stderr", text: chunk.toString() } });
    });
    child.on("error", (error) => {
      assistantText += error.message;
    });
    child.on("close", async (exitCode) => {
      this.running.delete(session.id);
      this.append(session.id, {
        id: nanoid(),
        role: "assistant",
        text: assistantText.trim() || `Codex exited with code ${exitCode ?? -1}.`,
        createdAt: Date.now(),
      });
      this.events.publish(session.id, { type: "codex.event", payload: { stream: "close", exitCode } });
      this.events.publish(session.id, { type: "git.state.updated", state: await this.git.state(session.cwd) });
    });

    return { running: true };
  }

  cancel(sessionId: string) {
    const child = this.running.get(sessionId);
    if (!child) return { running: false };
    child.kill("SIGTERM");
    this.running.delete(sessionId);
    return { running: false };
  }

  private append(sessionId: string, message: CodexMessage) {
    const messages = this.messages.get(sessionId) ?? [];
    messages.push(message);
    this.messages.set(sessionId, messages.slice(-200));
    this.events.publish(sessionId, { type: "codex.event", payload: { message } });
  }
}

function buildPrompt(prompt: string, mentions: ComposerMention[]) {
  const mentionText = mentions
    .map((mention) => (mention.type === "file" ? `- @${mention.path}${mention.isDirectory ? " (directory)" : ""}` : `- $${mention.name}`))
    .join("\n");
  return [
    "Command execution policy:",
    "- Use `cw job <command...>` for commands expected to finish.",
    "- Use `cw preview <command...>` for browser-viewable web apps.",
    "- Use `cw service <command...>` for long-running background services.",
    "- Do not run destructive Git commands without explicit user approval.",
    mentionText ? `\nSelected context:\n${mentionText}` : "",
    `\nUser request:\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractCodexText(text: string) {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const event = JSON.parse(line) as Record<string, unknown>;
        return typeof event.message === "string"
          ? event.message
          : typeof event.text === "string"
            ? event.text
            : typeof event.delta === "string"
              ? event.delta
              : "";
      } catch {
        return line;
      }
    })
    .filter(Boolean)
    .join("\n");
}
