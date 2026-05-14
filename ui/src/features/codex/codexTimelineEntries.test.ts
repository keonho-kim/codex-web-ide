import { expect, test } from "bun:test";
import type { CodexMessage } from "@/lib/types";
import type { CodexEventSummary } from "@/store/uiStore";
import { buildCodexTimelineEntries, codexTimelineScrollKey } from "@/features/codex/codexTimelineEntries";

test("renders SSE agent messages as transient assistant entries", () => {
  const entries = buildCodexTimelineEntries([], [
    assistantEvent({ id: "event-1", text: "Streaming response", timestamp: 100 }),
  ]);

  expect(entries).toEqual([
    expect.objectContaining({
      kind: "message",
      transient: true,
      message: expect.objectContaining({ role: "assistant", text: "Streaming response" }),
    }),
  ]);
});

test("keeps a repeated SSE response visible when the matching stored message is older", () => {
  const messages: CodexMessage[] = [{ id: "saved-1", role: "assistant", text: "Same response", createdAt: 50 }];
  const entries = buildCodexTimelineEntries(messages, [
    assistantEvent({ id: "event-1", text: "Same response", timestamp: 100 }),
  ]);

  expect(entries.filter((entry) => entry.kind === "message")).toHaveLength(2);
});

test("hides an SSE assistant entry after its saved message arrives", () => {
  const messages: CodexMessage[] = [{ id: "saved-1", role: "assistant", text: "Final response", createdAt: 150 }];
  const entries = buildCodexTimelineEntries(messages, [
    assistantEvent({ id: "event-1", text: "Final response", timestamp: 100 }),
  ]);

  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ kind: "message", id: "message-saved-1" });
  expect("transient" in entries[0]).toBe(false);
});

test("changes the scroll key when assistant text streams or running state changes", () => {
  const first = buildCodexTimelineEntries([], [
    assistantEvent({ id: "event-1", text: "Partial", timestamp: 100 }),
  ]);
  const next = buildCodexTimelineEntries([], [
    assistantEvent({ id: "event-1", text: "Partial response", timestamp: 100 }),
  ]);

  expect(codexTimelineScrollKey(first, true)).not.toBe(codexTimelineScrollKey(next, true));
  expect(codexTimelineScrollKey(next, true)).not.toBe(codexTimelineScrollKey(next, false));
});

test("hides routine thread lifecycle events from the chat timeline", () => {
  const entries = buildCodexTimelineEntries([], [
    { id: "thread-start", kind: "turn", label: "thread.started", title: "Connected to Codex", timestamp: 100 },
    { id: "turn-done", kind: "turn", label: "turn.completed", title: "Turn completed", status: "completed", timestamp: 200 },
    { id: "failure", kind: "error", label: "turn.failed", title: "Error", status: "failed", timestamp: 300 },
  ]);

  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ kind: "activity", id: "activity-failure" });
});

test("groups consecutive work events into one activity entry", () => {
  const entries = buildCodexTimelineEntries([], [
    { id: "cmd-1", kind: "command", label: "item.completed", title: "rg --files", timestamp: 100 },
    { id: "tool-1", kind: "tool", label: "item.completed", title: "mcp.read", timestamp: 110 },
  ]);

  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ kind: "activity" });
  if (entries[0].kind === "activity") expect(entries[0].events).toHaveLength(2);
});

function assistantEvent(input: { id: string; text: string; timestamp: number }): CodexEventSummary {
  return {
    id: input.id,
    kind: "assistant",
    label: "item.completed",
    sourceItemId: "assistant-item",
    text: input.text,
    timestamp: input.timestamp,
  };
}
