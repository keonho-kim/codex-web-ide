import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerApiRoutes } from "./api";
import type { AppServices } from "./api/context";
import { AuthManager, authRequired, isLoopbackRequest, type AuthState } from "./auth/authManager";
import { EventBus } from "./events/eventBus";
import { CodexManager } from "./managers/codexManager";
import { CodexHistoryStore } from "./managers/codex/historyStore";
import { CommandManager } from "./managers/commandManager";
import { FileManager } from "./managers/fileManager";
import { GitManager } from "./managers/gitManager";
import { SessionManager } from "./managers/sessionManager";
import { SkillManager } from "./managers/skillManager";
import { JsonStore } from "./managers/storage";
import { TerminalManager } from "./managers/terminalManager";
import { WorkspaceManager } from "./managers/workspaceManager";
import { createPlatformAdapter } from "./platform/adapter";
import { canUseBunFrontProxy, startBunFrontProxy } from "./proxy/bunFrontProxy";

export type ServerOptions = {
  host?: string;
  port?: number;
  previewPortStart?: number;
  previewPortEnd?: number;
  auth?: "enable" | "disable";
  onShutdownRequest?: () => void;
};

export async function createApp(options: ServerOptions = {}) {
  const store = new JsonStore();
  await store.ensure();

  const events = new EventBus();
  const workspace = new WorkspaceManager(store);
  const repair = await workspace.repairPersistedState();
  reportPersistedStateRepair(repair);
  const sessions = new SessionManager(store, workspace);
  const auth = new AuthManager(workspace, store);
  await auth.initialize(authRequired(options.host || process.env.CODEX_WEB_HOST || "127.0.0.1", options.auth), options.auth);
  const files = new FileManager(events);
  const git = new GitManager();
  const skills = new SkillManager();
  const commands = new CommandManager(events, git, store, options.previewPortStart, options.previewPortEnd);
  await commands.hydrate();
  const terminals = new TerminalManager();
  const codex = new CodexManager(events, git, sessions, skills, new CodexHistoryStore(store));
  await codex.hydrate(await sessions.list());
  const services = buildServices({
    events,
    workspace,
    sessions,
    files,
    git,
    codex,
    commands,
    terminals,
    auth,
    skills,
  });
  const app = express();
  app.locals.auth = auth;
  app.locals.services = services;
  app.locals.cleanup = () =>
    runCleanup([
      ["codex", () => codex.shutdown()],
      ["auth", () => auth.shutdown()],
      ["terminals", () => terminals.shutdown()],
      ["commands", () => commands.shutdown()],
      [
        "watchers",
        async () => {
          const activeSessions = await sessions.list();
          await Promise.allSettled(
            activeSessions.flatMap((session) => [
              withTimeout(files.unwatch(session.id), 1000, `file watcher ${session.id}`),
              withTimeout(git.unwatch(session.id), 1000, `git watcher ${session.id}`),
            ]),
          );
        },
      ],
    ]);

  for (const session of await sessions.list()) {
    files.watch(session.id, session.cwd);
    git.watch(session.id, session.cwd, events);
  }

  app.use(express.json({ limit: "5mb" }));
  app.use(auth.securityHeaders());
  app.use(auth.middleware());
  registerApiRoutes(app, services);
  serveStaticUi(app);
  app.use(errorHandler);

  return app;
}

export async function startServer(options: ServerOptions = {}) {
  const persisted = await new WorkspaceManager(new JsonStore()).getSettings();
  const host = options.host || process.env.CODEX_WEB_HOST || persisted.host;
  const port = options.port || Number(process.env.CODEX_WEB_PORT || persisted.port);
  const previewPortStart = options.previewPortStart || Number(process.env.CODEX_WEB_PREVIEW_PORT_START || persisted.previewPortStart);
  const previewPortEnd = options.previewPortEnd || Number(process.env.CODEX_WEB_PREVIEW_PORT_END || persisted.previewPortEnd);
  const app = await createApp({ host, port, previewPortStart, previewPortEnd, auth: options.auth });
  const auth = app.locals.auth as AuthManager | undefined;
  let requestShutdown = () => undefined;
  app.post("/api/shutdown", (req, res) => {
    if (!isLoopbackRequest(req)) {
      res.status(403).json({ error: "Shutdown is only allowed from localhost." });
      return;
    }
    res.json({ ok: true });
    setTimeout(requestShutdown, 25);
  });
  if (canUseBunFrontProxy()) {
    const services = app.locals.services as AppServices;
    const front = await startBunFrontProxy({ app, host, port, services });
    let closePromise: Promise<void> | undefined;
    const close = () =>
      (closePromise ??= runCleanup([
        ["app cleanup", () => app.locals.cleanup?.()],
        ["front proxy", () => withTimeout(front.close(), 1500, "front proxy")],
      ]));
    requestShutdown = () => {
      if (options.onShutdownRequest) options.onShutdownRequest();
      else void close();
    };
    return {
      host,
      port,
      auth: auth?.getStatus(),
      close,
    };
  }
  return new Promise<{ host: string; port: number; auth?: AuthState; close(): Promise<void> }>((resolve) => {
    const server = app.listen(port, host, () => {
      let closePromise: Promise<void> | undefined;
      const close = () => {
        closePromise ??= runCleanup([
          ["app cleanup", () => app.locals.cleanup?.()],
          [
            "http server",
            () =>
              withTimeout(
                new Promise<void>((done, reject) => {
                  server.close((error) => (error ? reject(error) : done()));
                }),
                1500,
                "http server",
              ),
          ],
        ]);
        return closePromise;
      };
      requestShutdown = () => {
        if (options.onShutdownRequest) options.onShutdownRequest();
        else void close();
      };
      resolve({
        host,
        port,
        auth: auth?.getStatus(),
        close,
      });
    });
  });
}

function buildServices({
  auth,
  codex,
  commands,
  events,
  files,
  git,
  sessions,
  skills,
  terminals,
  workspace,
}: {
  auth: AuthManager;
  codex: CodexManager;
  commands: CommandManager;
  terminals: TerminalManager;
  events: EventBus;
  files: FileManager;
  git: GitManager;
  sessions: SessionManager;
  skills: SkillManager;
  workspace: WorkspaceManager;
}) {
  return {
    events,
    workspace,
    sessions,
    files,
    git,
    skills,
    codex,
    commands,
    terminals,
    adapter: createPlatformAdapter(),
    auth,
  };
}

function reportPersistedStateRepair(repair: Awaited<ReturnType<WorkspaceManager["repairPersistedState"]>>) {
  const removed = repair.removedProjects.length + repair.removedSessions.length;
  if (removed === 0) return;
  console.warn(`Cleaned unsupported workspace entries: ${repair.removedProjects.length} project(s), ${repair.removedSessions.length} session(s).`);
  if (!process.env.CODEX_WEB_DEBUG_REPAIR) return;
  for (const project of repair.removedProjects) console.warn(`- project ${project.cwd}: ${project.reason}`);
  for (const session of repair.removedSessions) console.warn(`- session ${session.cwd}: ${session.reason}`);
}

async function runCleanup(steps: Array<[string, () => unknown | Promise<unknown>]>) {
  const failures: string[] = [];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) console.warn(`Shutdown completed with cleanup warnings: ${failures.join("; ")}`);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    timeout.unref?.();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function serveStaticUi(app: express.Express) {
  const uiDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../ui/dist");
  app.use(express.static(uiDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(uiDist, "index.html"), (error) => {
      if (error) res.status(200).send("<!doctype html><title>Codex Web IDE</title><div id=\"root\">UI build not found. Run bun run build:web.</div>");
    });
  });
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
}
