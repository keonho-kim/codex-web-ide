import { afterEach, describe, expect, test } from "bun:test";
import { execa } from "execa";
import express from "express";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { AuthManager, authRequired } from "./auth/authManager";
import type { AppServices } from "./api/context";
import { checkPreviewPorts } from "./cli/doctor/ports";
import { executeManagedCommand } from "./cli/managedCommands";
import { initProject } from "./cli/projectInit";
import { EventBus } from "./events/eventBus";
import { JsonStore } from "./managers/storage";
import { WorkspaceManager } from "./managers/workspaceManager";
import { consumeCodexEvents } from "./managers/codex/events";
import { buildCodexMentionContext } from "./managers/codex/mentions";
import { buildCodexPrompt } from "./managers/codex/prompt";
import { CommandManager } from "./managers/commandManager";
import { JobRunner } from "./managers/commands/jobRunner";
import { resolveCommandCwd } from "./managers/commands/path";
import { PortAllocator } from "./managers/commands/portAllocator";
import { PreviewRunner } from "./managers/commands/previewRunner";
import { ProcessRegistry } from "./managers/commands/processRegistry";
import { preparePreviewLaunch } from "./managers/commands/runtimeAdapter";
import { assertCommandAllowed } from "./managers/commands/safety";
import { ServiceRunner } from "./managers/commands/serviceRunner";
import { FileManager } from "./managers/fileManager";
import { safeFsPath } from "./managers/files/path";
import { GitManager } from "./managers/gitManager";
import { SessionManager } from "./managers/sessionManager";
import { SkillManager } from "./managers/skillManager";
import { startBunFrontProxy } from "./proxy/bunFrontProxy";
import { startServer } from "./server";
import {
  cleanupTempRoots,
  closeServer,
  codexEventStream,
  freePort,
  listenOn,
  restoreEnv,
  runCli,
  startCli,
  tempDir,
  testSession,
  waitForExit,
  waitForHealth,
  waitForJob,
  waitForPreview,
  waitForService,
  webSocketRoundTrip,
} from "./testing/productSmoke";

afterEach(async () => {
  await cleanupTempRoots();
});

describe("product smoke coverage", () => {
  test("uses Tailwind as the only UI stylesheet entrypoint", async () => {
    const uiSrc = path.resolve(import.meta.dir, "../../ui/src");
    const cssFiles: string[] = [];

    for await (const file of new Bun.Glob("**/*.css").scan({ cwd: uiSrc, onlyFiles: true })) {
      cssFiles.push(file);
    }

    expect(cssFiles.sort()).toEqual(["tailwind.css"]);

    const stylesheet = await fs.readFile(path.join(uiSrc, "tailwind.css"), "utf8");
    expect(stylesheet).toContain('@import "tailwindcss";');
    expect(stylesheet).toContain("@theme");
    expect(stylesheet).toContain("@layer base");
    expect(stylesheet).not.toContain("@layer components");
    expect(stylesheet).not.toContain("@layer utilities");
    expect(stylesheet).not.toMatch(/^\s*(\.|#|\[[^\]]+\])/m);
  });

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

  test("returns empty Git read models outside repositories", async () => {
    const root = await tempDir();
    const git = new GitManager();

    await expect(git.status(root)).resolves.toEqual([]);
    await expect(git.branch(root)).resolves.toEqual([]);
    await expect(git.diff(root)).resolves.toBe("");
  });

  test("parses Git status paths with spaces and renames", async () => {
    const root = await tempDir();
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "test@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "Test"], { cwd: root });
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "old.txt"), "old");
    await execa("git", ["add", "."], { cwd: root });
    await execa("git", ["commit", "-m", "init"], { cwd: root });

    await execa("git", ["mv", "src/old.txt", "src/new name.txt"], { cwd: root });
    await fs.writeFile(path.join(root, "src", "added space.txt"), "added");
    await execa("git", ["add", "src/added space.txt"], { cwd: root });

    const status = await new GitManager().status(root);

    expect(status.map((file) => file.path)).toContain("src/added space.txt");
    expect(status).toContainEqual(expect.objectContaining({ path: "src/new name.txt", index: "R" }));
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

  test("cancels managed jobs with an immediate terminal event", async () => {
    const root = await tempDir();
    const events = new EventBus();
    const runner = new JobRunner(events, new GitManager(), new ProcessRegistry());
    const session = testSession(root);
    const published: Array<{ type: string; jobId?: string; exitCode?: number }> = [];
    events.subscribe(session.id, (event) => published.push(event));
    const job = await runner.start(session, ["bun", "--eval", "setInterval(() => {}, 1000)"], { timeoutMs: 5000 });

    const cancelled = runner.cancel(session.id, job.id);

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.exitCode).toBe(-1);
    expect(published).toContainEqual(expect.objectContaining({ type: "job.finished", jobId: job.id, exitCode: -1 }));
  });

  test("managed CLI commands create cwd sessions and call command APIs", async () => {
    const cwd = await tempDir();
    const originalCwd = process.cwd();
    const calls: Array<{ pathName: string; body?: unknown; method?: string }> = [];
    process.chdir(cwd);
    try {
      const result = await executeManagedCommand("preview", ["--approve-dangerous", "bun", "run", "dev"], async (pathName, options = {}) => {
        calls.push({ pathName, body: options.body, method: options.method });
        if (pathName === "/api/sessions") {
          if (options.method === "POST") return { ...testSession(cwd), id: "created-session" } as never;
          return [] as never;
        }
        if (pathName === "/api/sessions/created-session/commands/preview") {
          return { id: "preview", sessionId: "created-session", cwd, command: ["bun", "run", "dev"] } as never;
        }
        throw new Error(`Unexpected API call: ${pathName}`);
      });

      expect(result.output).toContain("\"preview\"");
      expect(calls).toContainEqual({ pathName: "/api/sessions", body: { cwd }, method: "POST" });
      expect(calls).toContainEqual({
        pathName: "/api/sessions/created-session/commands/preview",
        method: "POST",
        body: { command: ["bun", "run", "dev"], cwd, approvedDangerous: true },
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("marks managed services running after health check", async () => {
    const root = await tempDir();
    const events = new EventBus();
    const runner = new ServiceRunner(events, new ProcessRegistry());
    const session = testSession(root);
    const published: Array<{ type: string }> = [];
    events.subscribe(session.id, (event) => published.push(event));
    const service = await runner.start(session, ["bun", "--eval", "setInterval(() => {}, 1000)"]);
    try {
      const running = await waitForService(() => runner.list(session.id).find((item) => item.id === service.id));

      expect(running.status).toBe("running");
      expect(running.lastHealthCheckAt).toBeTruthy();
      expect(published.some((event) => event.type === "service.health.updated")).toBe(true);
    } finally {
      runner.stop(session.id, service.id);
    }
  });

  test("starts managed previews on allocated local ports", async () => {
    const root = await tempDir();
    const port = await freePort();
    const runner = new PreviewRunner(new EventBus(), new PortAllocator(port, port), new ProcessRegistry());
    const session = testSession(root);
    const preview = await runner.start(session, [
      "bun",
      "--eval",
      "Bun.serve({ hostname: process.env.HOST, port: Number(process.env.PORT), fetch() { return new Response('preview ok'); } }); setInterval(() => {}, 1000);",
    ]);
    try {
      const running = await waitForPreview(() => runner.list(session.id).find((item) => item.id === preview.id));

      expect(running.status).toBe("running");
      expect(running.port).toBe(port);
      await expect(fetch(running.localUrl).then((res) => res.text())).resolves.toBe("preview ok");
    } finally {
      runner.stop(session.id, preview.id);
    }
  });

  test("hydrates stale running commands into terminal states", async () => {
    const root = await tempDir();
    const storeRoot = await tempDir();
    const store = new JsonStore(storeRoot);
    const session = testSession(root);
    await store.write("jobs.json", [{ id: "job", sessionId: session.id, cwd: root, command: ["bun", "test"], status: "running", startedAt: Date.now(), stdout: [], stderr: [] }]);
    await store.write("previews.json", [
      { id: "preview", sessionId: session.id, cwd: root, command: ["bun", "run", "dev"], port: 23456, pid: 123, status: "running", localUrl: "http://127.0.0.1:23456/", publicUrl: "/preview/session/preview/", startedAt: Date.now(), stdout: [], stderr: [] },
    ]);
    await store.write("services.json", [
      { id: "service", sessionId: session.id, cwd: root, command: ["bun", "worker.ts"], pid: 456, status: "starting", startedAt: Date.now(), restartCount: 0, stdout: [], stderr: [] },
    ]);

    const commands = new CommandManager(new EventBus(), new GitManager(), store);
    await commands.hydrate();

    expect(commands.getJob(session.id, "job").status).toBe("failed");
    expect(commands.listPreviews(session.id)[0]).toMatchObject({ id: "preview", pid: 0, status: "stopped" });
    expect(commands.listServices(session.id)[0]).toMatchObject({ id: "service", pid: 0, status: "stopped" });
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

  test("canonicalizes project and session working directories", async () => {
    const storeRoot = await tempDir();
    const projectRoot = await tempDir();
    const linkedProject = path.join(await tempDir(), "linked");
    await fs.symlink(projectRoot, linkedProject);
    const workspace = new WorkspaceManager(new JsonStore(storeRoot));
    const sessions = new SessionManager(new JsonStore(storeRoot), workspace);

    const first = await workspace.addProject({ cwd: projectRoot });
    const second = await workspace.addProject({ cwd: linkedProject });
    const session = await sessions.create({ cwd: linkedProject });

    expect(second.id).toBe(first.id);
    expect(second.cwd).toBe(await fs.realpath(projectRoot));
    expect(session.cwd).toBe(await fs.realpath(projectRoot));
    expect(await workspace.listProjects()).toHaveLength(1);
  });

  test("initializes projects with runtime AGENTS policy", async () => {
    const home = await tempDir();
    const projectRoot = await tempDir();
    const previousHome = process.env.CODEX_WEB_HOME;
    const originalLog = console.log;
    try {
      process.env.CODEX_WEB_HOME = home;
      console.log = () => undefined;
      await initProject([projectRoot]);

      const agents = await fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8");
      const workspace = new WorkspaceManager(new JsonStore(home));
      const projects = await workspace.listProjects();
      const settings = await workspace.getSettings();

      expect(agents).toContain("cw preview <command...>");
      expect(projects).toHaveLength(1);
      expect(settings.activeProjectId).toBe(projects[0].id);
    } finally {
      console.log = originalLog;
      restoreEnv("CODEX_WEB_HOME", previousHome);
    }
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

  test("starts, reports, and stops through the CLI", async () => {
    const home = await tempDir();
    const port = await freePort();
    const env = { CODEX_WEB_HOME: home, CODEX_WEB_AUTH: "0" };
    const server = startCli(["start", "--host", "127.0.0.1", "--port", String(port), "--preview-port-start", "25000", "--preview-port-end", "25010"], env);
    try {
      await waitForHealth(`http://127.0.0.1:${port}/api/health`);

      const status = await runCli(["status"], env);
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain("running: yes");
      expect(status.stdout).toContain(`url: http://127.0.0.1:${port}`);

      const stop = await runCli(["stop"], env);
      expect(stop.exitCode).toBe(0);
      expect(stop.stdout).toContain("stopped");
      await expect(waitForExit(server)).resolves.toBe(0);
    } finally {
      if (server.exitCode === null) server.kill("SIGTERM");
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
