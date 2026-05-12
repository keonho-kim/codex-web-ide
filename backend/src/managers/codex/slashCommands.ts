import type { CodexSlashCommandDefinition } from "@backend/shared/types";

// Source: OpenAI Codex TUI SlashCommand enum, checked against codex-cli 0.129.0.
export const CODEX_SLASH_COMMANDS: CodexSlashCommandDefinition[] = [
  { command: "model", description: "choose what model and reasoning effort to use", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "ide", description: "include current selection, open files, and other context from your IDE", category: "configuration", supportsInlineArgs: true, nativeSurface: "modal" },
  { command: "permissions", description: "choose what Codex is allowed to do", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "keymap", description: "remap TUI shortcuts", category: "configuration", supportsInlineArgs: true, nativeSurface: "modal", requiresConfirmation: true },
  { command: "vim", description: "toggle Vim mode for the composer", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "setup-default-sandbox", description: "set up elevated agent sandbox", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true, platform: "windows" },
  { command: "sandbox-add-read-dir", description: "let sandbox read an absolute directory path", category: "configuration", supportsInlineArgs: true, nativeSurface: "modal", requiresConfirmation: true, platform: "windows" },
  { command: "experimental", description: "toggle experimental features", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "approve", description: "approve one retry of a recent auto-review denial", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "memories", description: "configure memory use and generation", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "skills", description: "use skills to improve how Codex performs specific tasks", category: "workspace", supportsInlineArgs: false, nativeSurface: "modal" },
  { command: "hooks", description: "view and manage lifecycle hooks", category: "workspace", supportsInlineArgs: false, nativeSurface: "modal" },
  { command: "review", description: "review current changes and find issues", category: "conversation", supportsInlineArgs: true, nativeSurface: "composer" },
  { command: "rename", description: "rename the current thread", category: "conversation", supportsInlineArgs: true, nativeSurface: "modal", requiresConfirmation: true },
  { command: "new", description: "start a new chat during a conversation", category: "conversation", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "resume", description: "resume a saved chat", category: "conversation", supportsInlineArgs: true, nativeSurface: "modal" },
  { command: "fork", description: "fork the current chat", category: "conversation", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "init", description: "create an AGENTS.md file with instructions for Codex", category: "workspace", supportsInlineArgs: false, nativeSurface: "direct", requiresConfirmation: true },
  { command: "compact", description: "summarize conversation to prevent hitting the context limit", category: "conversation", supportsInlineArgs: false, nativeSurface: "composer", requiresConfirmation: true },
  { command: "plan", description: "switch to Plan mode", category: "conversation", supportsInlineArgs: true, nativeSurface: "composer" },
  { command: "goal", description: "set or view the goal for a long-running task", category: "conversation", supportsInlineArgs: true, nativeSurface: "modal", requiresConfirmation: true },
  { command: "collab", description: "change collaboration mode", category: "conversation", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "agent", description: "switch the active agent thread", category: "conversation", supportsInlineArgs: false, nativeSurface: "modal" },
  { command: "side", description: "start a side conversation in an ephemeral fork", category: "conversation", supportsInlineArgs: true, nativeSurface: "composer" },
  { command: "copy", description: "copy last response as markdown", category: "utility", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "raw", description: "toggle raw scrollback mode for copy-friendly selection", category: "utility", supportsInlineArgs: true, nativeSurface: "modal", requiresConfirmation: true },
  { command: "diff", description: "show git diff including untracked files", category: "workspace", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "mention", description: "mention a file", category: "workspace", supportsInlineArgs: false, nativeSurface: "composer" },
  { command: "status", description: "show current session configuration and token usage", category: "utility", supportsInlineArgs: false, nativeSurface: "tab" },
  { command: "debug-config", description: "show config layers and requirement sources for debugging", category: "debug", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "title", description: "configure which items appear in the terminal title", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "statusline", description: "configure which items appear in the status line", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "theme", description: "choose a syntax highlighting theme", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "mcp", description: "list configured MCP tools; use verbose for details", category: "workspace", supportsInlineArgs: true, nativeSurface: "modal" },
  { command: "apps", description: "manage apps", category: "workspace", supportsInlineArgs: false, nativeSurface: "modal" },
  { command: "plugins", description: "browse plugins", category: "workspace", supportsInlineArgs: false, nativeSurface: "modal" },
  { command: "logout", description: "log out of Codex", category: "utility", supportsInlineArgs: false, nativeSurface: "direct", requiresConfirmation: true },
  { command: "quit", description: "exit Codex", category: "utility", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "exit", description: "exit Codex", category: "utility", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "feedback", description: "send logs to maintainers", category: "utility", supportsInlineArgs: false, nativeSurface: "modal" },
  { command: "rollout", description: "print the rollout file path", category: "debug", supportsInlineArgs: false, nativeSurface: "direct", debugOnly: true },
  { command: "ps", description: "list background terminals", category: "utility", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "stop", description: "stop all background terminals", category: "utility", supportsInlineArgs: false, nativeSurface: "direct", requiresConfirmation: true },
  { command: "clean", description: "alias for stop all background terminals", category: "utility", supportsInlineArgs: false, nativeSurface: "direct", requiresConfirmation: true },
  { command: "clear", description: "clear the terminal and start a new chat", category: "conversation", supportsInlineArgs: false, nativeSurface: "direct" },
  { command: "personality", description: "choose a communication style for Codex", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "realtime", description: "toggle realtime voice mode", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "settings", description: "configure realtime microphone and speaker", category: "configuration", supportsInlineArgs: false, nativeSurface: "modal", requiresConfirmation: true },
  { command: "subagents", description: "switch the active agent thread", category: "conversation", supportsInlineArgs: false, nativeSurface: "modal" },
  { command: "debug-m-drop", description: "debug memory drop command", category: "debug", supportsInlineArgs: false, nativeSurface: "direct", debugOnly: true },
  { command: "debug-m-update", description: "debug memory update command", category: "debug", supportsInlineArgs: false, nativeSurface: "direct", debugOnly: true },
];

export function findCodexSlashCommand(command: string) {
  const normalized = normalizeSlashCommand(command);
  return CODEX_SLASH_COMMANDS.find((item) => item.command === normalized);
}

export function normalizeSlashCommand(command: string) {
  return command.trim().replace(/^\/+/, "").toLowerCase();
}
