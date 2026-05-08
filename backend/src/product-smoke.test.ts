import { afterEach, describe, expect, test } from "bun:test";
import express from "express";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { AuthManager, authRequired } from "./auth/authManager";
import type { AppServices } from "./api/context";
import { checkPreviewPorts } from "./cli/doctor/ports";
import { EventBus } from "./events/eventBus";
import { JsonStore } from "./managers/storage";
import { WorkspaceManager } from "./managers/workspaceManager";
import { consumeCodexEvents } from "./managers/codex/events";
import { buildCodexMentionContext } from "./managers/codex/mentions";
import { buildCodexPrompt } from "./managers/codex/prompt";
import { JobRunner } from "./managers/commands/jobRunner";
import { resolveCommandCwd } from "./managers/commands/path";
import { ProcessRegistry } from "./managers/commands/processRegistry";
import { preparePreviewLaunch } from "./managers/commands/runtimeAdapter";
import { assertCommandAllowed } from "./managers/commands/safety";
import { FileManager } from "./managers/fileManager";
import { safeFsPath } from "./managers/files/path";
import { GitManager } from "./managers/gitManager";
import { SkillManager } from "./managers/skillManager";
import { startBunFrontProxy } from "./proxy/bunFrontProxy";
import { startServer } from "./server";
import type { Session } from "./shared/types";

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

  test("requires approval for destructive commands", () => {
    expect(() => assertCommandAllowed(["git", "reset", "--hard"])).toThrow("explicit approval");
    expect(() => assertCommandAllowed(["git", "reset", "--hard"], true)).not.toThrow();
    expect(() => assertCommandAllowed(["rm", "-rf", "dist"])).toThrow("explicit approval");
  });

  test("blocks Git path escapes before staging", async () => {
    const root = await tempDir();
    const outside = await tempDir();
    await fs.writeFile(path.join(outside, "secret.txt"), "secret");
    await fs.symlink(outside, path.join(root, "linked"));

    await expect(new GitManager().stage(root, ["linked/secret.txt"])).rejects.toThrow("Path escape blocked");
  });

  test("runs managed jobs and captures output", async () => {
    const root = await tempDir();
    const runner = new JobRunner(new EventBus(), new GitManager(), new ProcessRegistry());
    const session = testSession(root);
    const job = await runner.start(session, ["bun", "--eval", "console.log('job ok')"], { timeoutMs: 5000 });

    const finished = await waitForJob(() => runner.get(session.id, job.id));

    expect(finished.status).toBe("succeeded");
    expect(finished.stdout.join("")).toContain("job ok");
    expect(finished.exitCode).toBe(0);
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

  test("requires tokens for forwarded non-loopback API requests", async () => {
    const workspace = new WorkspaceManager(new JsonStore(await tempDir()));
    const auth = new AuthManager(workspace);
    const settings = await workspace.updateSettings({ ...(await workspace.getSettings()), auth: { enabled: true, token: "secret-token" } });
    await auth.applySettings(settings, true);

    expect(auth.isAuthorizedHeaders(new Headers(), new URL("http://127.0.0.1/api/projects"), "192.168.1.10")).toBe(false);
    expect(auth.isAuthorizedHeaders(new Headers({ "x-codex-web-token": "secret-token" }), new URL("http://127.0.0.1/api/projects"), "192.168.1.10")).toBe(true);
    expect(auth.isAuthorizedHeaders(new Headers(), new URL("http://127.0.0.1/api/health"), "192.168.1.10")).toBe(true);
    expect(auth.isAuthorizedHeaders(new Headers(), new URL("http://127.0.0.1/api/projects"), "127.0.0.1")).toBe(true);
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

  test("codex completion publishes refreshed Git state", async () => {
    const events = new EventBus();
    const session = testSession(await tempDir());
    const published: Array<{ type: string }> = [];
    let assistantText = "";
    events.subscribe(session.id, (event) => published.push(event));

    await consumeCodexEvents({
      appendAssistantMessage: async (text) => {
        assistantText = text;
      },
      eventStream: codexEventStream([
        { type: "item.completed", item: { id: "message", type: "agent_message", text: "done" } },
      ]),
      events,
      git: { state: async () => ({ branch: "main", detached: false, commit: "abc", dirty: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0 }) } as unknown as GitManager,
      isDeleted: () => false,
      markCancelled: () => false,
      markNotRunning: () => undefined,
      session,
      sessions: { update: async () => session } as never,
      thread: { id: "codex-thread" } as never,
      updateThreadId: async () => undefined,
    });

    expect(assistantText).toBe("done");
    expect(published.some((event) => event.type === "git.state.updated")).toBe(true);
  });

  test("file tree includes nested project files and ignores generated folders", async () => {
    const root = await tempDir();
    await fs.mkdir(path.join(root, "a", "b", "c", "d", "e"), { recursive: true });
    await fs.writeFile(path.join(root, "a", "b", "c", "d", "e", "deep.ts"), "export {}\n");
    await fs.mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
    await fs.writeFile(path.join(root, "node_modules", "pkg", "hidden.ts"), "hidden\n");

    const tree = await new FileManager(new EventBus()).tree(root);
    const serialized = JSON.stringify(tree);

    expect(serialized).toContain("deep.ts");
    expect(serialized).not.toContain("hidden.ts");
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

  test("starts the app server and serves health and static fallback", async () => {
    const home = await tempDir();
    const previousHome = process.env.CODEX_WEB_HOME;
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    try {
      process.env.CODEX_WEB_HOME = home;
      const port = await freePort();
      server = await startServer({ host: "127.0.0.1", port, previewPortStart: 24000, previewPortEnd: 24010 });
      await expect(fetch(`http://127.0.0.1:${port}/api/health`).then((res) => res.json())).resolves.toMatchObject({ ok: true });
      const html = await fetch(`http://127.0.0.1:${port}/`).then((res) => res.text());
      expect(html).toContain("Codex Web IDE");
    } finally {
      await server?.close();
      restoreEnv("CODEX_WEB_HOME", previousHome);
    }
  });

  test("doctor reports occupied preview ports", async () => {
    const port = await freePort();
    const server = net.createServer();
    await listenOn(server, port);
    try {
      await expect(checkPreviewPorts(port, port)).resolves.toEqual({
        available: false,
        sampled: [`${port}:in-use`],
      });
    } finally {
      await closeServer(server);
    }
  });

  test("preview launch args are forced to the managed port", () => {
    expect(preparePreviewLaunch(["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"], 23456).command).toEqual([
      "uvicorn",
      "main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "23456",
    ]);
    expect(preparePreviewLaunch(["streamlit", "run", "app.py", "--server.port=9000"], 23456).command).toEqual([
      "streamlit",
      "run",
      "app.py",
      "--server.port=23456",
      "--server.address",
      "127.0.0.1",
    ]);
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

function listenOn(server: net.Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: net.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
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

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function testSession(cwd: string): Session {
  return {
    id: "session",
    cwd,
    name: "Session",
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    status: "idle",
  };
}

async function waitForJob(read: () => ReturnType<JobRunner["get"]>) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const job = read();
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return job;
    if (Date.now() > deadline) throw new Error("Job did not finish");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function* codexEventStream(events: unknown[]) {
  for (const event of events) yield event as never;
}
