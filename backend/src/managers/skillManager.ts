import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ComposerMention } from "@backend/shared/types";
import { safeFsPath } from "@backend/managers/files/path";

type SkillCandidate = Extract<ComposerMention, { type: "skill" }>;
export type SkillDocument = SkillCandidate & { markdown: string };

export class SkillManager {
  async search(sessionCwd: string, query: string): Promise<SkillCandidate[]> {
    const roots = await skillRoots(sessionCwd);
    const skills = (await Promise.all(roots.map((root) => this.readSkillRoot(root)))).flat();
    const needle = query.trim().toLowerCase();
    return skills
      .filter((skill) => !needle || skill.name.toLowerCase().includes(needle) || skill.id.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }

  async read(sessionCwd: string, id: string): Promise<SkillDocument | null> {
    if (!isSafeSkillId(id)) return null;
    for (const root of await skillRoots(sessionCwd)) {
      const markdown = await fs.readFile(path.join(root, id, "SKILL.md"), "utf8").catch(() => null);
      if (markdown === null) continue;
      return {
        type: "skill",
        id,
        name: readSkillName(markdown) || id,
        markdown,
      };
    }
    return null;
  }

  private async readSkillRoot(root: string): Promise<SkillCandidate[]> {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    const skills = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const skillDir = path.join(root, entry.name);
          const markdown = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8").catch(() => "");
          return {
            type: "skill" as const,
            id: entry.name,
            name: readSkillName(markdown) || entry.name,
          };
        }),
    );
    return skills;
  }
}

async function skillRoots(sessionCwd: string) {
  return [
    await localSkillRoot(sessionCwd),
    path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills"),
  ].filter((root): root is string => Boolean(root));
}

async function localSkillRoot(sessionCwd: string) {
  try {
    return await safeFsPath(sessionCwd, ".agents/skills");
  } catch {
    return null;
  }
}

function readSkillName(markdown: string) {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
  if (title) return title;
  return /^name:\s*(.+)$/m.exec(markdown)?.[1]?.trim();
}

function isSafeSkillId(id: string) {
  return Boolean(id && id !== "." && id !== ".." && !id.includes("/") && !id.includes("\\"));
}
