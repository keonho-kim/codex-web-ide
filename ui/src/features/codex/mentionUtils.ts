import type { ComposerMention, MentionPopupState } from "../../lib/types";

export function parseMentionSearch(value: string): MentionPopupState | null {
  const match = /(^|\s)([@$])([^\s@$]*)$/.exec(value);
  if (!match) return null;
  return { trigger: match[2] as "@" | "$", query: match[3] ?? "", selectedIndex: 0 };
}

export function mentionKey(mention: ComposerMention) {
  return mention.type === "file" ? `file:${mention.path}` : `skill:${mention.id}`;
}

export function mentionLabel(mention: ComposerMention) {
  return mention.type === "file" ? `@${mention.path}` : `$${mention.name}`;
}
