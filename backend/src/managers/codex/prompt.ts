import type { ComposerMention } from "@backend/shared/types";

export function buildCodexPrompt(prompt: string, mentions: ComposerMention[], mentionContext = "") {
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
    mentionContext ? `\nContext content:\n${mentionContext}` : "",
    `\nUser request:\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n");
}
