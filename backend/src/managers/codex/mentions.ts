import fs from "node:fs/promises";
import path from "node:path";
import type { ComposerMention } from "@backend/shared/types";
import type { SkillDocument } from "@backend/managers/skillManager";
import { safeFsPath } from "@backend/managers/files/path";

const MAX_FILE_CHARS = 20_000;
const MAX_SKILL_CHARS = 12_000;
const MAX_DIRECTORY_ENTRIES = 120;

export async function validateCodexMentions(sessionCwd: string, mentions: ComposerMention[]) {
  await Promise.all(mentions.map((mention) => (mention.type === "file" ? safeFsPath(sessionCwd, mention.path) : Promise.resolve())));
}

export async function buildCodexMentionContext(
  sessionCwd: string,
  mentions: ComposerMention[],
  readSkill?: (id: string) => Promise<SkillDocument | null>,
) {
  const sections = await Promise.all(
    mentions.map(async (mention) => {
      if (mention.type === "skill") return skillContext(mention, readSkill ? await readSkill(mention.id) : null);
      const absolute = await safeFsPath(sessionCwd, mention.path);
      const stat = await fs.stat(absolute);
      if (stat.isDirectory()) return directoryContext(sessionCwd, mention.path, absolute);
      return fileContext(mention.path, absolute);
    }),
  );
  return sections.join("\n\n");
}

function skillContext(mention: Extract<ComposerMention, { type: "skill" }>, document: SkillDocument | null) {
  if (!document) return `## Skill: $${mention.name}\nSkill id: ${mention.id}`;
  const truncated = document.markdown.length > MAX_SKILL_CHARS;
  const body = truncated ? document.markdown.slice(0, MAX_SKILL_CHARS) : document.markdown;
  return [`## Skill: $${document.name}`, "```md", body, truncated ? "\n[truncated]" : "", "```"].join("\n");
}

async function fileContext(relativePath: string, absolutePath: string) {
  const content = await fs.readFile(absolutePath, "utf8");
  const truncated = content.length > MAX_FILE_CHARS;
  const body = truncated ? content.slice(0, MAX_FILE_CHARS) : content;
  return [`## File: @${relativePath}`, "```", body, truncated ? "\n[truncated]" : "", "```"].join("\n");
}

async function directoryContext(sessionCwd: string, relativePath: string, absolutePath: string) {
  const entries = await listDirectoryEntries(sessionCwd, absolutePath);
  return [`## Directory: @${relativePath}`, entries.length ? entries.join("\n") : "(empty)"].join("\n");
}

async function listDirectoryEntries(sessionCwd: string, absolutePath: string) {
  const pending = [absolutePath];
  const entries: string[] = [];
  while (pending.length && entries.length < MAX_DIRECTORY_ENTRIES) {
    const current = pending.shift()!;
    const children = await fs.readdir(current, { withFileTypes: true });
    for (const child of children.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
      if (entries.length >= MAX_DIRECTORY_ENTRIES) break;
      if (child.name === "node_modules" || child.name === ".git") continue;
      const absolute = path.join(current, child.name);
      const relative = path.relative(sessionCwd, absolute);
      entries.push(`${child.isDirectory() ? "dir " : "file"} ${relative}`);
      if (child.isDirectory()) pending.push(absolute);
    }
  }
  if (pending.length) entries.push("[truncated]");
  return entries;
}
