import type { ComposerMention, MentionPopupState } from "@/lib/types";

export function parseMentionSearch(value: string, cursorIndex = value.length): MentionPopupState | null {
  const prefix = value.slice(0, cursorIndex);
  const match = /(^|\s)([@$])([^\s@$]*)$/.exec(prefix);
  if (!match) return null;
  const leadingWhitespace = match[1] ?? "";
  const tokenStart = match.index + leadingWhitespace.length;
  return { trigger: match[2] as "@" | "$", query: match[3] ?? "", selectedIndex: 0, start: tokenStart, end: cursorIndex };
}

export function mentionKey(mention: ComposerMention) {
  return mention.type === "file" ? `file:${mention.path}` : `skill:${mention.id}`;
}

export function mentionLabel(mention: ComposerMention) {
  return mention.type === "file" ? `@${mention.path}` : `$${mention.name}`;
}
