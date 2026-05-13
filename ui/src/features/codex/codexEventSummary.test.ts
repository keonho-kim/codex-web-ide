import { expect, test } from "bun:test";
import { summarizeCodexEvent } from "@/features/codex/codexEventSummary";

test("summarizes Codex agent_message items as assistant text", () => {
  const summary = summarizeCodexEvent(messageEvent({
    id: "event-1",
    timestamp: 100,
    payload: {
      type: "item.completed",
      item: { id: "item-1", type: "agent_message", text: "Done.\n\nThe folder contains files." },
    },
  }));

  expect(summary).toMatchObject({
    id: "event-1",
    kind: "assistant",
    label: "item.completed",
    sourceItemId: "item-1",
    role: "assistant",
    text: "Done.\n\nThe folder contains files.",
    timestamp: 100,
  });
});

test("summarizes command executions with command output and exit code", () => {
  const summary = summarizeCodexEvent(messageEvent({
    id: "event-2",
    timestamp: 200,
    payload: {
      type: "item.completed",
      item: {
        id: "cmd-1",
        type: "command_execution",
        command: "rg --files",
        aggregated_output: "PRODUCT.md\nDESIGN.md\n",
        exit_code: 0,
        status: "completed",
      },
    },
  }));

  expect(summary.kind).toBe("command");
  expect(summary.title).toBe("rg --files");
  expect(summary.preview).toContain("PRODUCT.md");
  expect(summary.body).toContain("$ rg --files");
  expect(summary.body).toContain("Exit code: 0");
});

test("summarizes other work items with readable details", () => {
  const summary = summarizeCodexEvent(messageEvent({
    id: "event-3",
    timestamp: 300,
    payload: {
      type: "item.completed",
      item: {
        id: "files-1",
        type: "file_change",
        status: "completed",
        changes: [
          { kind: "update", path: "ui/src/App.tsx" },
          { kind: "add", path: "ui/src/App.test.tsx" },
        ],
      },
    },
  }));

  expect(summary.kind).toBe("file");
  expect(summary.preview).toContain("ui/src/App.tsx");
  expect(summary.body).toContain("add ui/src/App.test.tsx");
});

test("summarizes thread and turn lifecycle events with friendly labels", () => {
  const started = summarizeCodexEvent(messageEvent({ id: "event-start", timestamp: 400, payload: { type: "thread.started", thread_id: "thread-1" } }));
  const completed = summarizeCodexEvent(messageEvent({ id: "event-done", timestamp: 500, payload: { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 2, reasoning_output_tokens: 3 } } }));

  expect(started).toMatchObject({ kind: "turn", title: "Connected to Codex", preview: "Thread is ready." });
  expect(completed).toMatchObject({ kind: "turn", title: "Turn completed", status: "completed" });
});

test("uses friendly labels for unknown raw Codex events", () => {
  const summary = summarizeCodexEvent(messageEvent({
    id: "event-raw",
    timestamp: 600,
    payload: { type: "thread.unrecognized_internal_event", thread_id: "thread-1" },
  }));

  expect(summary).toMatchObject({
    id: "event-raw",
    kind: "event",
    title: "Codex activity",
    preview: "Codex reported activity.",
  });
});

function messageEvent(envelope: unknown): Pick<MessageEvent, "type" | "data"> {
  return { type: "codex.event", data: JSON.stringify(envelope) };
}
