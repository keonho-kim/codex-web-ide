import type { CodexMessage } from "@/lib/types";
import type { CodexEventSummary } from "@/store/uiStore";

export type CodexTimelineEntry =
  | { kind: "message"; id: string; timestamp: number; message: CodexMessage; transient?: boolean }
  | { kind: "activity"; id: string; timestamp: number; events: CodexEventSummary[] };

export function buildCodexTimelineEntries(messages: CodexMessage[], events: CodexEventSummary[]): CodexTimelineEntry[] {
  const messageIds = new Set(messages.map((message) => message.id));
  const assistantMessages = messages
    .filter((message) => message.role === "assistant")
    .map((message) => ({ text: normalizeTimelineText(message.text), timestamp: message.createdAt }));

  const entries = [
    ...messages.map((message) => ({ kind: "message" as const, id: `message-${message.id}`, timestamp: message.createdAt, message })),
    ...events.flatMap<CodexTimelineEntry>((event) => eventEntries(event, messageIds, assistantMessages)),
  ].sort((left, right) => left.timestamp - right.timestamp);
  return groupActivityEntries(entries);
}

export function codexTimelineScrollKey(entries: CodexTimelineEntry[], running: boolean) {
  const last = entries.at(-1);
  if (!last) return `empty:${running}`;
  if (last.kind === "message") return `message:${last.id}:${last.message.text.length}:${running}`;
  return `activity:${last.id}:${last.events.map((event) => `${event.id}:${event.status ?? ""}:${(event.body ?? event.detail ?? event.preview ?? "").length}`).join("|")}:${running}`;
}

function eventEntries(
  event: CodexEventSummary,
  messageIds: Set<string>,
  assistantMessages: Array<{ text: string; timestamp: number }>,
): CodexTimelineEntry[] {
  if (event.messageId && messageIds.has(event.messageId)) return [];
  if (isRoutineLifecycleEvent(event)) return [];
  if (event.kind !== "assistant") return [{ kind: "activity", id: `activity-${event.id}`, timestamp: event.timestamp, events: [event] }];

  const text = event.text ?? event.detail ?? "";
  if (hasStoredAssistantReplacement(text, event.timestamp, assistantMessages)) return [];
  return [
    {
      kind: "message",
      id: `event-message-${event.id}`,
      timestamp: event.timestamp,
      transient: true,
      message: {
        id: event.id,
        role: "assistant",
        text,
        createdAt: event.timestamp,
      },
    },
  ];
}

function hasStoredAssistantReplacement(text: string, eventTimestamp: number, assistantMessages: Array<{ text: string; timestamp: number }>) {
  const normalized = normalizeTimelineText(text);
  if (!normalized) return false;
  return assistantMessages.some((message) => message.text === normalized && message.timestamp >= eventTimestamp);
}

function normalizeTimelineText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function isRoutineLifecycleEvent(event: CodexEventSummary) {
  return event.kind === "turn" && event.status !== "failed";
}

function groupActivityEntries(entries: CodexTimelineEntry[]) {
  const grouped: CodexTimelineEntry[] = [];
  let pending: Extract<CodexTimelineEntry, { kind: "activity" }> | undefined;
  for (const entry of entries) {
    if (entry.kind === "activity") {
      pending = pending
        ? {
            ...pending,
            id: `${pending.id}-${entry.id}`,
            timestamp: Math.min(pending.timestamp, entry.timestamp),
            events: [...pending.events, ...entry.events],
          }
        : entry;
      continue;
    }
    if (pending) {
      grouped.push(pending);
      pending = undefined;
    }
    grouped.push(entry);
  }
  if (pending) grouped.push(pending);
  return grouped;
}
