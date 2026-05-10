import { nanoid } from "nanoid";
import type { Thread, ThreadEvent } from "@openai/codex-sdk";
import type { EventBus } from "../../events/eventBus";
import type { CodexStatusSnapshot, Session } from "../../shared/types";
import type { GitManager } from "../gitManager";
import type { SessionManager } from "../sessionManager";

export async function consumeCodexEvents({
  events,
  eventStream,
  git,
  isDeleted,
  markNotRunning,
  markCancelled,
  session,
  sessions,
  thread,
  appendAssistantMessage,
  recordUsage,
  updateThreadId,
}: {
  events: EventBus;
  eventStream: AsyncGenerator<ThreadEvent>;
  git: GitManager;
  isDeleted(): boolean;
  markNotRunning(): void;
  markCancelled(): boolean;
  session: Session;
  sessions: SessionManager;
  thread: Thread;
  appendAssistantMessage(text: string): Promise<void>;
  recordUsage(usage: CodexStatusSnapshot["usage"]): void;
  updateThreadId(codexThreadId: string): Promise<void>;
}) {
  const agentMessages = new Map<string, string>();
  let failure: string | undefined;
  let cancelled = false;
  try {
    for await (const event of eventStream) {
      events.publish(session.id, { type: "codex.event", payload: event });
      const usage = extractTokenUsage(event);
      if (usage) recordUsage(usage);
      if (event.type === "thread.started") {
        await updateThreadId(event.thread_id);
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
    cancelled = markCancelled();
    if (!cancelled) failure = error instanceof Error ? error.message : "Codex run failed.";
  } finally {
    markNotRunning();
    if (isDeleted()) return;
    if (!cancelled) cancelled = markCancelled();
    if (thread.id) await updateThreadId(thread.id);
    const text = [...agentMessages.values()].join("\n").trim();
    await appendAssistantMessage(text || failure || (cancelled ? "Codex run cancelled." : "Codex run finished without a response."));
    await sessions.update(session.id, { status: failure ? "error" : "idle" });
    try {
      events.publish(session.id, { type: "git.state.updated", state: await git.state(session.cwd) });
    } catch (error) {
      events.publish(session.id, { type: "codex.event", payload: { type: "git.refresh.failed", message: error instanceof Error ? error.message : "Git refresh failed." } });
    }
  }
}

export function createAssistantMessage(text: string) {
  return {
    id: nanoid(),
    role: "assistant" as const,
    text,
    createdAt: Date.now(),
  };
}

function extractTokenUsage(event: ThreadEvent): CodexStatusSnapshot["usage"] | undefined {
  const usage = findUsageObject(event);
  if (!usage) return undefined;
  const inputTokens = numberValue(usage.input_tokens ?? usage.inputTokens);
  const outputTokens = numberValue(usage.output_tokens ?? usage.outputTokens);
  const reasoningOutputTokens = numberValue(usage.reasoning_output_tokens ?? usage.reasoningOutputTokens);
  const totalTokens = numberValue(usage.total_tokens ?? usage.totalTokens) ?? (inputTokens ?? 0) + (outputTokens ?? 0);
  if (!inputTokens && !outputTokens && !reasoningOutputTokens && !totalTokens) return undefined;
  return {
    inputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
    lastEventAt: Date.now(),
  };
}

function findUsageObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.usage && typeof record.usage === "object") return record.usage as Record<string, unknown>;
  for (const child of Object.values(record)) {
    const found = findUsageObject(child);
    if (found) return found;
  }
  return undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
