import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AuthManager, authRequired } from "./auth/authManager";
import { JsonStore } from "./managers/storage";
import { WorkspaceManager } from "./managers/workspaceManager";
import { buildCodexMentionContext } from "./managers/codex/mentions";
import { buildCodexPrompt } from "./managers/codex/prompt";
import { safeFsPath } from "./managers/files/path";
import { SkillManager } from "./managers/skillManager";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("product smoke coverage", () => {
  test("blocks symlink escapes in session paths", async () => {
    const root = await tempDir();
    const outside = await tempDir();
    await fs.writeFile(path.join(outside, "secret.txt"), "secret");
    await fs.symlink(outside, path.join(root, "linked"));

    await expect(safeFsPath(root, "linked/secret.txt")).rejects.toThrow("Path escape blocked");
  });

  test("removes workspace projects from active and recent state", async () => {
    const storeRoot = await tempDir();
    const projectRoot = await tempDir();
    const workspace = new WorkspaceManager(new JsonStore(storeRoot));

    const project = await workspace.addProject({ cwd: projectRoot });
    await workspace.openProject(project.id);
    await workspace.removeProject(project.id);

    await expect(workspace.listProjects()).resolves.toEqual([]);
    const settings = await workspace.getSettings();
    expect(settings.activeProjectId).toBeUndefined();
    expect(settings.recentProjectIds).not.toContain(project.id);
  });

  test("generates and applies workspace auth token settings", async () => {
    const workspace = new WorkspaceManager(new JsonStore(await tempDir()));
    const auth = new AuthManager(workspace);
    const settings = await workspace.updateSettings({ ...(await workspace.getSettings()), auth: { enabled: true } });

    await auth.applySettings(settings, authRequired(settings.host));

    expect(auth.getStatus().enabled).toBe(true);
    expect((await workspace.getSettings()).auth.token).toBeTruthy();
  });

  test("includes selected file, directory, and skill context in Codex prompts", async () => {
    const root = await tempDir();
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "README.md"), "hello codex\n");
    await fs.writeFile(path.join(root, "src", "app.ts"), "export const value = 1;\n");
    await fs.mkdir(path.join(root, ".agents", "skills", "reviewer"), { recursive: true });
    await fs.writeFile(path.join(root, ".agents", "skills", "reviewer", "SKILL.md"), "# Reviewer\nUse careful review.\n");

    const skills = new SkillManager();
    const mentions = [
      { type: "file" as const, path: "README.md", isDirectory: false },
      { type: "file" as const, path: "src", isDirectory: true },
      { type: "skill" as const, id: "reviewer", name: "Reviewer" },
    ];
    const context = await buildCodexMentionContext(root, mentions, (id) => skills.read(root, id));
    const prompt = buildCodexPrompt("do the work", mentions, context);

    expect(prompt).toContain("hello codex");
    expect(prompt).toContain("file src/app.ts");
    expect(prompt).toContain("Use careful review.");
  });
});

async function tempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-web-test-"));
  tempRoots.push(dir);
  return dir;
}
