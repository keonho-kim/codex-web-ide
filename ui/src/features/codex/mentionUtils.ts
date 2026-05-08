import type { ComposerMention } from "../../lib/types";

export type MentionSearch = {
  trigger: "@" | "$";
  query: string;
  selectedIndex: number;
};

export function parseMentionSearch(value: string): MentionSearch | null {
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
