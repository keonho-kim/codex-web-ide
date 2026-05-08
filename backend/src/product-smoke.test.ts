import { afterEach, describe, expect, test } from "bun:test";
import express from "express";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { AuthManager, authRequired } from "./auth/authManager";
import type { AppServices } from "./api/context";
import { JsonStore } from "./managers/storage";
import { WorkspaceManager } from "./managers/workspaceManager";
import { buildCodexMentionContext } from "./managers/codex/mentions";
import { buildCodexPrompt } from "./managers/codex/prompt";
import { resolveCommandCwd } from "./managers/commands/path";
import { safeFsPath } from "./managers/files/path";
import { SkillManager } from "./managers/skillManager";
import { startBunFrontProxy } from "./proxy/bunFrontProxy";

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

  test("blocks command cwd escapes", async () => {
    const root = await tempDir();
    const outside = await tempDir();

    await expect(resolveCommandCwd(root, outside)).rejects.toThrow("Path escape blocked");
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

  test("proxies HTTP and preview WebSockets through Bun front proxy", async () => {
    const upstreamPort = await freePort();
    const frontPort = await freePort();
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: upstreamPort,
      fetch(req, server) {
        return server.upgrade(req) ? undefined : new Response("upstream");
      },
      websocket: {
        message(ws, message) {
          ws.send(`echo:${String(message)}`);
        },
      },
    });
    const app = express();
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    const services = {
      auth: { isAuthorizedHeaders: () => true },
      commands: {
        getPreviewTarget: (sessionId: string, previewId: string) =>
          sessionId === "session" && previewId === "preview" ? `http://127.0.0.1:${upstreamPort}` : null,
      },
    } as unknown as AppServices;
    const front = await startBunFrontProxy({ app, host: "127.0.0.1", port: frontPort, services });
    try {
      await expect(fetch(`http://127.0.0.1:${frontPort}/api/health`).then((res) => res.json())).resolves.toEqual({ ok: true });
      await expect(webSocketRoundTrip(`ws://127.0.0.1:${frontPort}/preview/session/preview/hmr`, "ping")).resolves.toBe("echo:ping");
    } finally {
      await front.close();
      upstream.stop(true);
    }
  });
});

async function tempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-web-test-"));
  tempRoots.push(dir);
  return dir;
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No port assigned"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function webSocketRoundTrip(url: string, message: string) {
  return new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error("WebSocket timeout")), 3000);
    ws.addEventListener("open", () => ws.send(message));
    ws.addEventListener("message", (event) => {
      clearTimeout(timer);
      ws.close();
      resolve(String(event.data));
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket error"));
    });
  });
}
