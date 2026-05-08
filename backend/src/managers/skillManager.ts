import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ComposerMention } from "../shared/types";
import { safePath } from "./fileManager";

type SkillCandidate = Extract<ComposerMention, { type: "skill" }>;

export class SkillManager {
  async search(sessionCwd: string, query: string): Promise<SkillCandidate[]> {
    const roots = [
      safePath(sessionCwd, ".agents/skills"),
      path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills"),
    ];
    const skills = (await Promise.all(roots.map((root) => this.readSkillRoot(root)))).flat();
    const needle = query.trim().toLowerCase();
    return skills
      .filter((skill) => !needle || skill.name.toLowerCase().includes(needle) || skill.id.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
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

function readSkillName(markdown: string) {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
  if (title) return title;
  return /^name:\s*(.+)$/m.exec(markdown)?.[1]?.trim();
}
