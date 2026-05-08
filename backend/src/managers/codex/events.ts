import { nanoid } from "nanoid";
import type { Thread, ThreadEvent } from "@openai/codex-sdk";
import type { EventBus } from "../../events/eventBus";
import type { Session } from "../../shared/types";
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
  updateThreadId(codexThreadId: string): Promise<void>;
}) {
  const agentMessages = new Map<string, string>();
  let failure: string | undefined;
  let cancelled = false;
  try {
    for await (const event of eventStream) {
      events.publish(session.id, { type: "codex.event", payload: event });
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
