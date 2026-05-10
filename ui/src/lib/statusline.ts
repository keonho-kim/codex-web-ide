export type CodexStatusLineItem =
  | "context-remaining"
  | "current-dir"
  | "git-branch"
  | "five-hour-limit"
  | "model-with-reasoning"
  | "run-state"
  | "context-window-size"
  | "task-progress";

export type StatusLineItemDefinition = {
  id: CodexStatusLineItem;
  label: string;
  description: string;
};

export const STATUSLINE_ITEMS: StatusLineItemDefinition[] = [
  { id: "context-remaining", label: "context-remaining", description: "Percentage of context window remaining, shown when known." },
  { id: "current-dir", label: "current-dir", description: "Current working directory for the active session." },
  { id: "git-branch", label: "git-branch", description: "Current Git branch, omitted when unavailable." },
  { id: "five-hour-limit", label: "five-hour-limit", description: "Remaining usage on the 5-hour limit, shown when available." },
  { id: "model-with-reasoning", label: "model-with-reasoning", description: "Current model name with reasoning level." },
  { id: "run-state", label: "run-state", description: "Compact Codex run state such as Ready, Working, or Error." },
  { id: "context-window-size", label: "context-window-size", description: "Context window size, shown when Codex reports it." },
  { id: "task-progress", label: "task-progress", description: "Active Codex, job, and service work tracked by Codex Web." },
];

export const DEFAULT_STATUSLINE_ITEMS: CodexStatusLineItem[] = [
  "context-remaining",
  "current-dir",
  "git-branch",
  "five-hour-limit",
  "model-with-reasoning",
  "run-state",
  "context-window-size",
  "task-progress",
];

const STATUSLINE_ITEM_IDS = new Set<string>(STATUSLINE_ITEMS.map((item) => item.id));
const LEGACY_STATUSLINE_ITEM_MAP: Record<string, CodexStatusLineItem | null> = {
  model: "model-with-reasoning",
  reasoning: "model-with-reasoning",
  branch: "git-branch",
  tokens: "context-remaining",
  permissions: null,
  changes: null,
  raw: null,
};

export function normalizeStatuslineItems(value?: readonly string[]): CodexStatusLineItem[] {
  if (!value) return DEFAULT_STATUSLINE_ITEMS;
  const normalized: CodexStatusLineItem[] = [];
  for (const item of value) {
    const mapped = LEGACY_STATUSLINE_ITEM_MAP[item] ?? item;
    if (!mapped || !STATUSLINE_ITEM_IDS.has(mapped) || normalized.includes(mapped as CodexStatusLineItem)) continue;
    normalized.push(mapped as CodexStatusLineItem);
  }
  if (normalized.length > 0) return normalized;
  return value.length === 0 ? [] : DEFAULT_STATUSLINE_ITEMS;
}
