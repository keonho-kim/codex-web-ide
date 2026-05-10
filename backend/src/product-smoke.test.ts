import { afterEach, describe, expect, test } from "bun:test";
import { execa } from "execa";
import express from "express";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { AuthManager, authRequired } from "./auth/authManager";
import { SecretsStore } from "./auth/secretsStore";
import { registerFileRoutes } from "./api/fileRoutes";
import { registerGitRoutes } from "./api/gitRoutes";
import { registerSessionRoutes } from "./api/sessionRoutes";
import type { AppServices } from "./api/context";
import { checkPreviewPorts } from "./cli/doctor/ports";
import { executeManagedCommand } from "./cli/managedCommands";
import { initProject } from "./cli/projectInit";
import { createSignalShutdown, parseAuthFlag } from "./cli/serverCommands";
import { EventBus } from "./events/eventBus";
import { JsonStore } from "./managers/storage";
import { WorkspaceManager } from "./managers/workspaceManager";
import { CodexManager } from "./managers/codexManager";
import { consumeCodexEvents } from "./managers/codex/events";
import { CodexHistoryStore } from "./managers/codex/historyStore";
import { buildCodexMentionContext } from "./managers/codex/mentions";
import { buildCodexPrompt } from "./managers/codex/prompt";
import { CODEX_SLASH_COMMANDS } from "./managers/codex/slashCommands";
import { CodexThreadManager } from "./managers/codex/threads";
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
import { isLongLivedHttpRequest, startBunFrontProxy } from "./proxy/bunFrontProxy";
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
  terminalWebSocketContains,
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

async function waitForLoginApproval(port: number, requestId: string) {
  const deadline = Date.now() + 6000;
  for (;;) {
    const status = await fetch(`http://127.0.0.1:${port}/api/auth/login/${requestId}/status`).then((res) => res.json() as Promise<{ status: string; completeToken?: string }>);
    if (status.status === "approved") return status;
    if (status.status === "denied" || status.status === "expired") throw new Error(`Login request ${status.status}`);
    if (Date.now() > deadline) throw new Error("Login request was not approved");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

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

  test("publishes Git state after mutating Git API calls", async () => {
    const root = await tempDir();
    await execa("git", ["init"], { cwd: root });
    await fs.writeFile(path.join(root, "app.ts"), "export {}\n");

    const session = testSession(root);
    const events = new EventBus();
    const published: Array<{ type: string }> = [];
    events.subscribe(session.id, (event) => published.push(event));
    const app = express();
    app.use(express.json());
    registerGitRoutes(app, {
      events,
      git: new GitManager(),
      sessions: { get: async () => session } as never,
    } as unknown as AppServices);
    const port = await freePort();
    const server = await new Promise<net.Server>((resolve, reject) => {
      const listener = app.listen(port, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/sessions/${session.id}/git/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: ["app.ts"] }),
      });

      expect(response.ok).toBe(true);
      expect(await response.json()).toMatchObject({ stagedCount: 1, dirty: true });
      expect(published).toContainEqual(expect.objectContaining({ type: "git.state.updated" }));
    } finally {
      await closeServer(server);
    }
  });

  test("keeps session event streams alive and publishes chunks", async () => {
    const root = await tempDir();
    const session = testSession(root);
    const events = new EventBus();
    const app = express();
    app.use(express.json());
    registerSessionRoutes(app, {
      codex: {},
      commands: {},
      events,
      files: {},
      git: {},
      sessions: { get: async () => session, list: async () => [session] },
    } as unknown as AppServices);
    const port = await freePort();
    const server = await new Promise<net.Server>((resolve, reject) => {
      const listener = app.listen(port, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    const controller = new AbortController();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/sessions/${session.id}/events`, { signal: controller.signal });
      expect(response.ok).toBe(true);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      const reader = response.body?.getReader();
      expect(reader).toBeTruthy();
      const first = await reader!.read();
      expect(new TextDecoder().decode(first.value)).toContain(": connected");

      events.publish(session.id, {
        type: "git.state.updated",
        state: { branch: null, commit: null, detached: false, dirty: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0 },
      });
      const next = await reader!.read();
      expect(new TextDecoder().decode(next.value)).toContain("event: git.state.updated");
      await reader!.cancel();
    } finally {
      controller.abort();
      await closeServer(server);
    }
  });

  test("multiplexes session event streams for active and running sessions", async () => {
    const first = { ...testSession(await tempDir()), id: "first" };
    const second = { ...testSession(await tempDir()), id: "second" };
    const events = new EventBus();
    const app = express();
    app.use(express.json());
    registerSessionRoutes(app, {
      codex: {},
      commands: {},
      events,
      files: {},
      git: {},
      sessions: { get: async (id: string) => (id === first.id ? first : second), list: async () => [first, second] },
    } as unknown as AppServices);
    const port = await freePort();
    const server = await new Promise<net.Server>((resolve, reject) => {
      const listener = app.listen(port, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    const controller = new AbortController();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/sessions/events?ids=${first.id},${second.id}`, { signal: controller.signal });
      expect(response.ok).toBe(true);
      const reader = response.body?.getReader();
      expect(reader).toBeTruthy();
      await reader!.read();

      events.publish(second.id, {
        type: "git.state.updated",
        state: { branch: null, commit: null, detached: false, dirty: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0 },
      });
      const next = await reader!.read();
      const chunk = new TextDecoder().decode(next.value);
      expect(chunk).toContain("event: git.state.updated");
      expect(chunk).toContain(`"sessionId":"${second.id}"`);
      await reader!.cancel();
    } finally {
      controller.abort();
      await closeServer(server);
    }
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
    const canonicalCwd = await fs.realpath(cwd);
    const originalCwd = process.cwd();
    const calls: Array<{ pathName: string; body?: unknown; method?: string }> = [];
    process.chdir(cwd);
    try {
      const result = await executeManagedCommand("preview", ["--approve-dangerous", "bun", "run", "dev"], async (pathName, options = {}) => {
        calls.push({ pathName, body: options.body, method: options.method });
        if (pathName === "/api/sessions") {
          if (options.method === "POST") return { ...testSession(canonicalCwd), id: "created-session" } as never;
          return [] as never;
        }
        if (pathName === "/api/sessions/created-session/commands/preview") {
          return { id: "preview", sessionId: "created-session", cwd: canonicalCwd, command: ["bun", "run", "dev"] } as never;
        }
        throw new Error(`Unexpected API call: ${pathName}`);
      });

      expect(result.output).toContain("\"preview\"");
      expect(calls).toContainEqual({ pathName: "/api/sessions", body: { cwd: canonicalCwd }, method: "POST" });
      expect(calls).toContainEqual({
        pathName: "/api/sessions/created-session/commands/preview",
        method: "POST",
        body: { command: ["bun", "run", "dev"], cwd: canonicalCwd, approvedDangerous: true },
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("signal shutdown exits after graceful cleanup", async () => {
    const exits: number[] = [];
    let removeCount = 0;
    const shutdown = createSignalShutdown(
      async () => undefined,
      {
        exit: (code) => exits.push(code),
        log: () => undefined,
        error: () => undefined,
        removePid: async () => {
          removeCount += 1;
        },
      },
    );

    shutdown();
    await delay(0);

    expect(exits).toEqual([0]);
    expect(removeCount).toBe(1);
  });

  test("signal shutdown force exits on repeated signal or timeout", async () => {
    const repeatedExits: number[] = [];
    const repeated = createSignalShutdown(
      () => new Promise<void>(() => undefined),
      { timeoutMs: 60_000, exit: (code) => repeatedExits.push(code), log: () => undefined, error: () => undefined, removePid: async () => undefined },
    );
    repeated();
    repeated();
    expect(repeatedExits).toEqual([130]);

    const timeoutExits: number[] = [];
    const timedOut = createSignalShutdown(
      () => new Promise<void>(() => undefined),
      { timeoutMs: 5, exit: (code) => timeoutExits.push(code), log: () => undefined, error: () => undefined, removePid: async () => undefined },
    );
    timedOut();
    await delay(20);
    expect(timeoutExits).toEqual([1]);
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

  test("uses home shorthand as the default project browse location", async () => {
    const workspace = new WorkspaceManager(new JsonStore(await tempDir()));

    await expect(workspace.getSettings()).resolves.toMatchObject({ defaultProjectsDir: "~" });
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

  test("allows multiple conversation sessions per project", async () => {
    const storeRoot = await tempDir();
    const projectRoot = await tempDir();
    const store = new JsonStore(storeRoot);
    const workspace = new WorkspaceManager(store);
    const sessions = new SessionManager(store, workspace);
    const project = await workspace.addProject({ cwd: projectRoot });

    const first = await sessions.create({ projectId: project.id });
    const second = await sessions.create({ projectId: project.id });

    expect(first.id).not.toBe(second.id);
    expect((await sessions.list()).filter((session) => session.projectId === project.id)).toHaveLength(2);
  });

  test("allows concurrent conversation sessions across projects", async () => {
    const storeRoot = await tempDir();
    const firstRoot = await tempDir();
    const secondRoot = await tempDir();
    const store = new JsonStore(storeRoot);
    const workspace = new WorkspaceManager(store);
    const sessions = new SessionManager(store, workspace);
    const firstProject = await workspace.addProject({ cwd: firstRoot });
    const secondProject = await workspace.addProject({ cwd: secondRoot });

    const firstSession = await sessions.create({ projectId: firstProject.id });
    const secondSession = await sessions.create({ projectId: secondProject.id });

    expect(firstSession.projectId).toBe(firstProject.id);
    expect(secondSession.projectId).toBe(secondProject.id);
    expect((await sessions.list()).map((session) => session.projectId).sort()).toEqual([firstProject.id, secondProject.id].sort());
  });

  test("browses project folders with files visible and creates folders", async () => {
    const storeRoot = await tempDir();
    const projectRoot = await tempDir();
    await fs.mkdir(path.join(projectRoot, "src"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "README.md"), "hello\n");
    const workspace = new WorkspaceManager(new JsonStore(storeRoot));

    const listing = await workspace.browsePath(projectRoot);
    expect(listing.path).toBe(projectRoot);
    expect(listing.entries).toContainEqual(expect.objectContaining({ name: "src", isDirectory: true }));
    expect(listing.entries).toContainEqual(expect.objectContaining({ name: "README.md", isDirectory: false }));

    const next = await workspace.createBrowseFolder({ path: projectRoot, name: "new-folder" });
    expect(next.path).toBe(path.join(projectRoot, "new-folder"));
    expect((await fs.stat(path.join(projectRoot, "new-folder"))).isDirectory()).toBe(true);
  });

  test("expands home-relative project and session paths", async () => {
    const previousHome = process.env.HOME;
    const storeRoot = await tempDir();
    const home = await tempDir();
    const projectRoot = path.join(home, "projects", "app");
    await fs.mkdir(projectRoot, { recursive: true });
    try {
      process.env.HOME = home;
      const workspace = new WorkspaceManager(new JsonStore(storeRoot));
      const sessions = new SessionManager(new JsonStore(storeRoot), workspace);

      const project = await workspace.addProject({ cwd: "~/projects/app" });
      const session = await sessions.create({ cwd: "~/projects/app" });

      expect(project.cwd).toBe(await fs.realpath(projectRoot));
      expect(session.cwd).toBe(await fs.realpath(projectRoot));
    } finally {
      restoreEnv("HOME", previousHome);
    }
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

  test("requires Telegram configuration before enabling auth", async () => {
    const store = new JsonStore(await tempDir());
    const workspace = new WorkspaceManager(store);
    const auth = new AuthManager(workspace, store);
    const settings = await workspace.updateSettings({ ...(await workspace.getSettings()), auth: { ...(await workspace.getSettings()).auth, enabled: true } });

    await expect(auth.applySettings(settings, true)).rejects.toThrow("Telegram auth is not configured");
  });

  test("defaults the CLI auth flag to disabled", () => {
    expect(parseAuthFlag([])).toBe("disable");
    expect(parseAuthFlag(["--auth", "enable"])).toBe("enable");
    expect(parseAuthFlag(["--auth", "disable"])).toBe("disable");
    expect(() => parseAuthFlag(["--auth", "invalid"])).toThrow("--auth must be either enable or disable.");
  });

  test("applies Telegram auth settings without issuing legacy auth tokens", async () => {
    const store = new JsonStore(await tempDir());
    const workspace = new WorkspaceManager(store);
    const auth = new AuthManager(workspace, store);
    await auth.configureTelegram({ botToken: "test-token", allowedTelegramUserId: 123, allowedChatId: 456, ownerDisplayName: "Owner", botUsername: "bot" });
    const settings = await workspace.updateSettings({ ...(await workspace.getSettings()), auth: { ...(await workspace.getSettings()).auth, enabled: true } });
    await auth.applySettings(settings, authRequired(settings.host));

    expect(auth.getStatus().enabled).toBe(true);
    expect(auth.getStatus().configured).toBe(true);
    expect("token" in (await workspace.getSettings()).auth).toBe(false);
  });

  test("rejects forwarded non-loopback API requests without a browser session", async () => {
    const store = new JsonStore(await tempDir());
    const workspace = new WorkspaceManager(store);
    const auth = new AuthManager(workspace, store);
    await auth.configureTelegram({ botToken: "test-token", allowedTelegramUserId: 123, allowedChatId: 456, ownerDisplayName: "Owner", botUsername: "bot" });
    const settings = await workspace.updateSettings({ ...(await workspace.getSettings()), auth: { ...(await workspace.getSettings()).auth, enabled: true } });
    await auth.applySettings(settings, true);

    expect(auth.isAuthorizedHeaders(new Headers(), new URL("http://127.0.0.1/api/projects"), "192.168.1.10")).toBe(false);
    expect(auth.isAuthorizedHeaders(new Headers(), new URL("http://127.0.0.1/api/health"), "192.168.1.10")).toBe(true);
    expect(auth.isAuthorizedHeaders(new Headers(), new URL("http://127.0.0.1/api/projects"), "127.0.0.1")).toBe(false);
  });

  test("approves browser login through Telegram and enforces CSRF", async () => {
    const home = await tempDir();
    const previousHome = process.env.CODEX_WEB_HOME;
    const previousTelegramBase = process.env.CW_TELEGRAM_API_BASE;
    const telegramPort = await freePort();
    const appPort = await freePort();
    const updates: unknown[] = [];
    let callbackData = "";
    const telegram = Bun.serve({
      hostname: "127.0.0.1",
      port: telegramPort,
      async fetch(req) {
        const url = new URL(req.url);
        const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
        if (url.pathname.endsWith("/getMe")) return Response.json({ ok: true, result: { id: 1, username: "codex_test_bot" } });
        if (url.pathname.endsWith("/sendMessage")) {
          const markup = body.reply_markup as { inline_keyboard?: Array<Array<{ callback_data?: string }>> } | undefined;
          callbackData = markup?.inline_keyboard?.[0]?.[0]?.callback_data ?? "";
          return Response.json({ ok: true, result: { message_id: 1 } });
        }
        if (url.pathname.endsWith("/getUpdates")) return Response.json({ ok: true, result: updates.splice(0) });
        if (url.pathname.endsWith("/answerCallbackQuery")) return Response.json({ ok: true, result: true });
        return Response.json({ ok: false, description: "unknown method" }, { status: 404 });
      },
    });
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    try {
      process.env.CODEX_WEB_HOME = home;
      process.env.CW_TELEGRAM_API_BASE = `http://127.0.0.1:${telegramPort}`;
      const store = new JsonStore(home);
      await store.ensure();
      const workspace = new WorkspaceManager(store);
      const settings = await workspace.getSettings();
      await workspace.updateSettings({
        ...settings,
        auth: { ...settings.auth, enabled: true },
        telegram: { allowedTelegramUserId: 123, allowedChatId: 456, ownerDisplayName: "Owner", botUsername: "codex_test_bot", remoteControlEnabled: false },
      });
      await new SecretsStore(store).write({ telegram: { botToken: "telegram-token" }, auth: { sessionSecret: "session-secret", csrfSecret: "csrf-secret" } });
      server = await startServer({ host: "127.0.0.1", port: appPort, auth: "enable", previewPortStart: 24200, previewPortEnd: 24210 });

      const loginRequest = await fetch(`http://127.0.0.1:${appPort}/api/auth/login/request`, {
        method: "POST",
        headers: { Origin: `http://127.0.0.1:${appPort}` },
      }).then((res) => res.json() as Promise<{ requestId: string; code: string }>);
      expect(loginRequest.requestId.startsWith("lr_")).toBe(true);
      expect(callbackData).toContain(loginRequest.requestId);
      updates.push({
        update_id: 1,
        callback_query: {
          id: "callback-1",
          data: callbackData,
          from: { id: 123, first_name: "Owner" },
          message: { chat: { id: 456 }, message_id: 1 },
        },
      });
      const approved = await waitForLoginApproval(appPort, loginRequest.requestId);
      expect(approved.completeToken).toBeTruthy();
      const complete = await fetch(`http://127.0.0.1:${appPort}/api/auth/login/${loginRequest.requestId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${appPort}` },
        body: JSON.stringify({ completeToken: approved.completeToken }),
      });
      expect(complete.ok).toBe(true);
      const cookie = complete.headers.get("set-cookie")?.split(";")[0] ?? "";
      const completed = (await complete.json()) as { csrfToken: string };
      expect(cookie.startsWith("cw_session=")).toBe(true);
      expect(completed.csrfToken).toBeTruthy();
      const rejected = await fetch(`http://127.0.0.1:${appPort}/api/auth/heartbeat`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: `http://127.0.0.1:${appPort}` },
      });
      expect(rejected.status).toBe(403);
      const accepted = await fetch(`http://127.0.0.1:${appPort}/api/auth/heartbeat`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: `http://127.0.0.1:${appPort}`, "X-CSRF-Token": completed.csrfToken },
      });
      expect(accepted.ok).toBe(true);
    } finally {
      await server?.close();
      telegram.stop(true);
      restoreEnv("CODEX_WEB_HOME", previousHome);
      restoreEnv("CW_TELEGRAM_API_BASE", previousTelegramBase);
    }
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

  test("codex slash command registry covers current native command surfaces", async () => {
    const commands = CODEX_SLASH_COMMANDS.map((command) => command.command);
    expect(new Set(commands).size).toBe(commands.length);
    expect(commands).toContain("status");
    expect(commands).toContain("statusline");
    expect(commands).toContain("experimental");
    expect(commands).toContain("model");
    expect(commands).toContain("permissions");
    expect(commands).toContain("review");
    expect(commands).toContain("subagents");
    expect(CODEX_SLASH_COMMANDS.length).toBeGreaterThanOrEqual(50);
  });

  test("codex slash status and settings commands expose native results", async () => {
    const root = await tempDir();
    await execa("git", ["init"], { cwd: root });
    const store = new JsonStore(path.join(root, ".store"));
    await store.ensure();
    const workspace = new WorkspaceManager(store);
    const sessions = new SessionManager(store, workspace);
    const session = await sessions.create({ cwd: root, name: "slash" });
    const codex = new CodexManager(new EventBus(), new GitManager(), sessions, new SkillManager(), new CodexHistoryStore(store));

    const status = await codex.runSlashCommand(session, { command: "status" });
    expect(status.status?.session.name).toBe("slash");
    expect(status.status?.commands.supported).toBe(CODEX_SLASH_COMMANDS.length);

    const applied = await codex.runSlashCommand(session, { command: "statusline", options: { statuslineItems: ["model", "tokens"] } });
    expect(applied.message).toContain("/statusline");
    expect((await codex.listMessages(session)).at(-1)?.text).toContain("statuslineItems: model, tokens");
  });

  test("codex hydrate clears stale running session state", async () => {
    const root = await tempDir();
    const store = new JsonStore(path.join(root, ".store"));
    await store.ensure();
    const workspace = new WorkspaceManager(store);
    const sessions = new SessionManager(store, workspace);
    const session = await sessions.create({ cwd: root, name: "stale" });
    await sessions.update(session.id, { status: "running" });
    const codex = new CodexManager(new EventBus(), new GitManager(), sessions, new SkillManager(), new CodexHistoryStore(store));

    await codex.hydrate(await sessions.list());

    expect((await sessions.get(session.id)).status).toBe("idle");
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
      recordUsage: () => undefined,
      session,
      sessions: { update: async () => session } as never,
      thread: { id: "codex-thread" } as never,
      updateThreadId: async () => undefined,
    });

    expect(assistantText).toBe("done");
    expect(published.some((event) => event.type === "git.state.updated")).toBe(true);
  });

  test("deletes Codex threads and allows an empty thread list", async () => {
    const storeRoot = await tempDir();
    const projectRoot = await tempDir();
    const store = new JsonStore(storeRoot);
    const workspace = new WorkspaceManager(store);
    const sessions = new SessionManager(store, workspace);
    const history = new CodexHistoryStore(store);
    const threads = new CodexThreadManager(sessions, history);
    const project = await workspace.addProject({ cwd: projectRoot });
    const createdSession = await sessions.create({ projectId: project.id });
    const first = await threads.create(createdSession, "First");
    const second = await threads.create(await sessions.get(createdSession.id), "Second");
    await history.save(second.id, [{ id: "message", role: "user", text: "hello", createdAt: Date.now() }]);

    const result = await threads.delete(await sessions.get(createdSession.id), second.id);
    expect(result.activeThreadId).toBe(first.id);
    await expect(history.list(second.id)).resolves.toEqual([]);

    const empty = await threads.delete(await sessions.get(createdSession.id), first.id);
    const updatedSession = await sessions.get(createdSession.id);
    expect(empty).toMatchObject({ threads: [], activeThreadId: null });
    expect(updatedSession.activeCodexThreadId).toBeUndefined();
    expect(await threads.current(updatedSession)).toBeNull();
    expect(await threads.list(updatedSession)).toMatchObject({ threads: [], activeThreadId: null });
  });

  test("file tree includes nested project files and ignores generated folders", async () => {
    const root = await tempDir();
    await fs.mkdir(path.join(root, "a", "b", "c", "d", "e"), { recursive: true });
    await fs.writeFile(path.join(root, "a", "b", "c", "d", "e", "deep.ts"), "export {}\n");
    await fs.mkdir(path.join(root, "a", "b", "c", "d", "e", "f", "g"), { recursive: true });
    await fs.writeFile(path.join(root, "a", "b", "c", "d", "e", "f", "g", "mention-target.ts"), "export {}\n");
    await fs.mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
    await fs.writeFile(path.join(root, "node_modules", "pkg", "hidden.ts"), "hidden\n");
    await fs.mkdir(path.join(root, ".git"), { recursive: true });
    await fs.writeFile(path.join(root, ".git", "index.lock"), "lock\n");

    const files = new FileManager(new EventBus());
    const tree = await files.tree(root);
    const serialized = JSON.stringify(tree);
    const mentions = await files.search(root, "mention-target");
    const gitMentions = await files.search(root, "index.lock");

    expect(serialized).toContain("deep.ts");
    expect(serialized).not.toContain("hidden.ts");
    expect(serialized).not.toContain("index.lock");
    expect(mentions).toContainEqual(expect.objectContaining({ path: "a/b/c/d/e/f/g/mention-target.ts" }));
    expect(gitMentions).toEqual([]);
  });

  test("recognizes long-lived session event routes for Bun timeout handling", () => {
    expect(isLongLivedHttpRequest(new URL("http://127.0.0.1/api/sessions/events?ids=session"))).toBe(true);
    expect(isLongLivedHttpRequest(new URL("http://127.0.0.1/api/sessions/session/events"))).toBe(true);
    expect(isLongLivedHttpRequest(new URL("http://127.0.0.1/api/sessions/session/codex/events"))).toBe(true);
    expect(isLongLivedHttpRequest(new URL("http://127.0.0.1/api/sessions/session/git/state"))).toBe(false);
  });

  test("publishes file changes after mutating File API calls", async () => {
    const root = await tempDir();
    const session = testSession(root);
    const events = new EventBus();
    const published: Array<{ type: string; path?: string }> = [];
    events.subscribe(session.id, (event) => published.push(event));
    const app = express();
    app.use(express.json());
    registerFileRoutes(app, {
      events,
      files: new FileManager(events),
      sessions: { get: async () => session } as never,
    } as unknown as AppServices);
    const port = await freePort();
    const server = await new Promise<net.Server>((resolve, reject) => {
      const listener = app.listen(port, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/sessions/${session.id}/files/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "src/app.ts", content: "export {}\n" }),
      });

      expect(response.status).toBe(201);
      await expect(fs.readFile(path.join(root, "src", "app.ts"), "utf8")).resolves.toBe("export {}\n");
      expect(published).toContainEqual(expect.objectContaining({ type: "file.changed", path: "src/app.ts" }));
    } finally {
      await closeServer(server);
    }
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

  test("opens PTY terminals over the editor WebSocket route", async () => {
    const home = await tempDir();
    const cwd = await tempDir();
    const previousHome = process.env.CODEX_WEB_HOME;
    const previousShell = process.env.SHELL;
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    try {
      process.env.CODEX_WEB_HOME = home;
      process.env.SHELL = path.join(home, "missing-shell");
      const port = await freePort();
      server = await startServer({ host: "127.0.0.1", port, previewPortStart: 24100, previewPortEnd: 24110 });
      const session = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, name: "PTY" }),
      }).then((res) => res.json() as Promise<{ id: string }>);
      const terminal = await fetch(`http://127.0.0.1:${port}/api/sessions/${session.id}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols: 80, rows: 20 }),
      }).then((res) => res.json() as Promise<{ id: string; status: string }>);
      expect(terminal.status).toBe("running");
      await expect(terminalWebSocketContains(`ws://127.0.0.1:${port}/api/sessions/${session.id}/terminals/${terminal.id}/ws`, "echo pty-ok\r", "pty-ok")).resolves.toContain("pty-ok");
      await expect(fetch(`http://127.0.0.1:${port}/api/sessions/${session.id}/terminals`).then((res) => res.json())).resolves.toHaveLength(1);
    } finally {
      await server?.close();
      restoreEnv("CODEX_WEB_HOME", previousHome);
      restoreEnv("SHELL", previousShell);
    }
  });

  test("starts, reports, and stops through the CLI", async () => {
    const home = await tempDir();
    const port = await freePort();
    const env = { CODEX_WEB_HOME: home, CODEX_WEB_AUTH: "0" };
    const server = startCli(["start", "--host", "127.0.0.1", "--port", String(port), "--preview-port-start", "25000", "--preview-port-end", "25010"], env);
    try {
      await waitForHealth(`http://127.0.0.1:${port}/api/health`);

      const duplicateStart = await runCli(["start", "--host", "127.0.0.1", "--port", String(port)], env);
      expect(duplicateStart.exitCode).toBe(0);
      expect(duplicateStart.stdout).toContain(`Codex Web IDE already running on http://127.0.0.1:${port}`);

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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
