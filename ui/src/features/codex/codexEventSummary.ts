import type { CodexEventSummary } from "@/store/uiStore";

type Envelope = {
  id?: string;
  timestamp?: number;
  payload?: unknown;
};

type MessagePayload = {
  id?: string;
  role?: "assistant" | "user" | "system";
  text: string;
};

const MAX_BODY_LENGTH = 12000;
const MAX_PREVIEW_LENGTH = 180;

export function summarizeCodexEvent(event: Pick<MessageEvent, "type" | "data">): CodexEventSummary {
  const fallback = fallbackSummary(event.type);
  try {
    const envelope = JSON.parse(event.data) as Envelope;
    const payload = envelope.payload;
    if (!payload || typeof payload !== "object") return fallback;
    return summarizePayload(payload as Record<string, unknown>, {
      id: envelope.id || fallback.id,
      timestamp: typeof envelope.timestamp === "number" ? envelope.timestamp : Date.now(),
      eventType: event.type,
    });
  } catch {
    return fallback;
  }
}

function summarizePayload(record: Record<string, unknown>, meta: { id: string; timestamp: number; eventType: string }): CodexEventSummary {
  const message = messagePayload(record.message);
  if (message) {
    return {
      id: meta.id,
      kind: message.role === "assistant" ? "assistant" : "event",
      label: `codex.${message.role ?? "message"}`,
      title: message.role === "assistant" ? "Assistant" : titleCase(message.role ?? "Message"),
      detail: message.text,
      preview: previewText(message.text),
      body: bodyText(message.text),
      messageId: message.id,
      role: message.role,
      text: message.text,
      timestamp: meta.timestamp,
    };
  }

  const type = stringValue(record.type) ?? meta.eventType;
  const item = objectValue(record.item);
  if (item && type.startsWith("item.")) return summarizeItem(type, item, meta);
  if (type === "turn.failed") return summarizeFailure(meta, type, objectValue(record.error)?.message ?? record.error);
  if (type === "error") return summarizeFailure(meta, type, record.message);
  if (type === "turn.completed") return summarizeTurnCompleted(record, meta, type);
  if (type === "turn.started") return baseSummary(meta, { kind: "turn", label: type, title: "Starting work", preview: "Codex is preparing the next step." });
  if (type === "thread.started") return baseSummary(meta, { kind: "turn", label: type, title: "Connected to Codex", preview: "Thread is ready." });

  const detail = eventDetail(record);
  return baseSummary(meta, {
    kind: "event",
    label: type,
    title: friendlyEventTitle(type),
    detail: detail ?? "Codex reported activity.",
    preview: detail ? previewText(detail) : "Codex reported activity.",
    body: detail ?? "Codex reported activity.",
  });
}

function summarizeItem(type: string, item: Record<string, unknown>, meta: { id: string; timestamp: number }) {
  const itemType = stringValue(item.type) ?? type;
  const sourceItemId = stringValue(item.id);
  if (itemType === "agent_message") {
    const text = stringValue(item.text) ?? "";
    return baseSummary(meta, {
      kind: "assistant",
      label: type,
      title: "Assistant",
      detail: text,
      preview: previewText(text),
      body: bodyText(text),
      sourceItemId,
      role: "assistant",
      text,
    });
  }
  if (itemType === "command_execution") return summarizeCommand(type, item, meta, sourceItemId);
  if (itemType === "mcp_tool_call") return summarizeTool(type, item, meta, sourceItemId);
  if (itemType === "file_change") return summarizeFileChange(type, item, meta, sourceItemId);
  if (itemType === "reasoning") return summarizeTextItem(type, item, meta, sourceItemId, "reasoning", "Reasoning");
  if (itemType === "web_search") return summarizeTextItem(type, item, meta, sourceItemId, "search", "Web search", stringValue(item.query));
  if (itemType === "todo_list") return summarizeTodo(type, item, meta, sourceItemId);
  if (itemType === "error") return summarizeFailure(meta, type, item.message, sourceItemId);
  const detail = readableItemType(itemType);
  return baseSummary(meta, {
    kind: "event",
    label: type,
    title: "Codex activity",
    status: eventStatus(type),
    detail,
    preview: detail,
    body: detail,
    sourceItemId,
  });
}

function summarizeCommand(type: string, item: Record<string, unknown>, meta: { id: string; timestamp: number }, sourceItemId?: string): CodexEventSummary {
  const command = stringValue(item.command) ?? "Command";
  const output = stringValue(item.aggregated_output) ?? "";
  const status = stringValue(item.status);
  const exitCode = numberValue(item.exit_code);
  const preview = output ? previewText(output) : status === "in_progress" ? "Running." : exitCode === undefined ? "No output captured." : `Exited with code ${exitCode}.`;
  const body = [`$ ${command}`, output, exitCode === undefined ? undefined : `Exit code: ${exitCode}`].filter(Boolean).join("\n\n");
  return baseSummary(meta, {
    kind: "command",
    label: type,
    title: command,
    status,
    detail: command,
    preview,
    body: bodyText(body || preview),
    sourceItemId,
  });
}

function summarizeTool(type: string, item: Record<string, unknown>, meta: { id: string; timestamp: number }, sourceItemId?: string): CodexEventSummary {
  const server = stringValue(item.server) ?? "mcp";
  const tool = stringValue(item.tool) ?? "tool";
  const error = objectValue(item.error);
  const result = objectValue(item.result);
  const resultText = result ? contentBlocksText(result.content) || safeStringify(result.structured_content ?? result) : undefined;
  const detail = error ? stringValue(error.message) : resultText || safeStringify(item.arguments);
  return baseSummary(meta, {
    kind: "tool",
    label: type,
    title: `${server}.${tool}`,
    status: stringValue(item.status),
    detail,
    preview: detail ? previewText(detail) : undefined,
    body: bodyText(detail ?? safeStringify(item)),
    sourceItemId,
  });
}

function summarizeFileChange(type: string, item: Record<string, unknown>, meta: { id: string; timestamp: number }, sourceItemId?: string): CodexEventSummary {
  const changes = arrayValue(item.changes).map((change) => objectValue(change)).filter((change): change is Record<string, unknown> => Boolean(change));
  const lines = changes.map((change) => `${stringValue(change.kind) ?? "update"} ${stringValue(change.path) ?? "(unknown path)"}`);
  const detail = lines.join("\n") || "No file changes listed.";
  return baseSummary(meta, {
    kind: "file",
    label: type,
    title: "File changes",
    status: stringValue(item.status),
    detail,
    preview: previewText(lines.join(", ") || detail),
    body: detail,
    sourceItemId,
  });
}

function summarizeTextItem(
  type: string,
  item: Record<string, unknown>,
  meta: { id: string; timestamp: number },
  sourceItemId: string | undefined,
  kind: CodexEventSummary["kind"],
  title: string,
  text = stringValue(item.text),
): CodexEventSummary {
  return baseSummary(meta, {
    kind,
    label: type,
    title,
    detail: text,
    preview: text ? previewText(text) : undefined,
    body: text,
    sourceItemId,
  });
}

function summarizeTodo(type: string, item: Record<string, unknown>, meta: { id: string; timestamp: number }, sourceItemId?: string): CodexEventSummary {
  const todos = arrayValue(item.items).map((todo) => objectValue(todo)).filter((todo): todo is Record<string, unknown> => Boolean(todo));
  const completed = todos.filter((todo) => todo.completed === true).length;
  const lines = todos.map((todo) => `${todo.completed === true ? "[x]" : "[ ]"} ${stringValue(todo.text) ?? ""}`.trim());
  return baseSummary(meta, {
    kind: "todo",
    label: type,
    title: "Plan",
    preview: `${completed}/${todos.length} completed`,
    body: lines.join("\n"),
    sourceItemId,
  });
}

function summarizeFailure(meta: { id: string; timestamp: number }, label: string, value: unknown, sourceItemId?: string): CodexEventSummary {
  const message = stringValue(value) ?? "Codex reported an error.";
  return baseSummary(meta, {
    kind: "error",
    label,
    title: "Error",
    status: "failed",
    detail: message,
    preview: previewText(message),
    body: message,
    sourceItemId,
  });
}

function summarizeTurnCompleted(record: Record<string, unknown>, meta: { id: string; timestamp: number }, label: string): CodexEventSummary {
  const usage = objectValue(record.usage);
  const detail = usage
    ? [
        `Input tokens: ${numberValue(usage.input_tokens) ?? 0}`,
        `Output tokens: ${numberValue(usage.output_tokens) ?? 0}`,
        `Reasoning tokens: ${numberValue(usage.reasoning_output_tokens) ?? 0}`,
      ].join("\n")
    : "Turn completed.";
  return baseSummary(meta, { kind: "turn", label, title: "Turn completed", status: "completed", detail, preview: "Turn completed.", body: detail });
}

function baseSummary(
  meta: { id: string; timestamp: number },
  summary: Omit<CodexEventSummary, "id" | "timestamp">,
): CodexEventSummary {
  return { id: meta.id, timestamp: meta.timestamp, ...summary };
}

function eventStatus(type: string) {
  if (type.endsWith(".started")) return "in_progress";
  if (type.endsWith(".completed")) return "completed";
  return undefined;
}

function fallbackSummary(label: string): CodexEventSummary {
  return { id: randomId(), kind: "event", label, title: "Codex activity", timestamp: Date.now() };
}

function eventDetail(record: Record<string, unknown>) {
  if (typeof record.message === "string") return record.message;
  const error = objectValue(record.error);
  if (error) return stringValue(error.message);
  const item = objectValue(record.item);
  if (item) return stringValue(item.type);
  return undefined;
}

function messagePayload(value: unknown): MessagePayload | null {
  const record = objectValue(value);
  if (!record) return null;
  const text = stringValue(record.text);
  if (text === undefined) return null;
  const role = record.role === "assistant" || record.role === "user" || record.role === "system" ? record.role : undefined;
  return { id: stringValue(record.id), role, text };
}

function contentBlocksText(value: unknown) {
  return arrayValue(value)
    .map((block) => {
      const record = objectValue(block);
      return record && record.type === "text" ? stringValue(record.text) : undefined;
    })
    .filter((text): text is string => Boolean(text))
    .join("\n");
}

function previewText(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > MAX_PREVIEW_LENGTH ? `${compact.slice(0, MAX_PREVIEW_LENGTH - 1)}...` : compact;
}

function bodyText(text: string) {
  return text.length > MAX_BODY_LENGTH ? `${text.slice(0, MAX_BODY_LENGTH)}\n... output truncated ...` : text;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function friendlyEventTitle(type: string) {
  if (type.includes("approval")) return "Approval requested";
  if (type.includes("git")) return "Git updated";
  if (type.includes("tool")) return "Tool activity";
  if (type.includes("command")) return "Command activity";
  return "Codex activity";
}

function readableItemType(type: string) {
  return titleCase(type.replace(/[._-]+/g, " "));
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `event-${Math.random().toString(36).slice(2)}`;
}
