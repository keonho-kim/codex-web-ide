import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerApiRoutes } from "./api";
import { AuthManager, authRequired, type AuthState } from "./auth/authManager";
import { EventBus } from "./events/eventBus";
import { CodexManager } from "./managers/codexManager";
import { CodexHistoryStore } from "./managers/codex/historyStore";
import { CommandManager } from "./managers/commandManager";
import { FileManager } from "./managers/fileManager";
import { GitManager } from "./managers/gitManager";
import { SessionManager } from "./managers/sessionManager";
import { SkillManager } from "./managers/skillManager";
import { JsonStore } from "./managers/storage";
import { WorkspaceManager } from "./managers/workspaceManager";
import { createPlatformAdapter } from "./platform/adapter";

export type ServerOptions = {
  host?: string;
  port?: number;
  previewPortStart?: number;
  previewPortEnd?: number;
};

export async function createApp(options: ServerOptions = {}) {
  const store = new JsonStore();
  await store.ensure();

  const events = new EventBus();
  const workspace = new WorkspaceManager(store);
  const sessions = new SessionManager(store, workspace);
  const auth = new AuthManager(workspace);
  await auth.initialize(authRequired(options.host || process.env.CODEX_WEB_HOST || "127.0.0.1"));
  const files = new FileManager(events);
  const git = new GitManager();
  const commands = new CommandManager(events, git, store, options.previewPortStart, options.previewPortEnd);
  await commands.hydrate();
  const codex = new CodexManager(events, git, sessions, new CodexHistoryStore(store));
  await codex.hydrate(await sessions.list());
  const services = {
    events,
    workspace,
    sessions,
    files,
    git,
    skills: new SkillManager(),
    codex,
    commands,
    adapter: createPlatformAdapter(),
    auth,
  };
  const app = express();
  app.locals.auth = auth;
  app.locals.cleanup = async () => {
    const activeSessions = await sessions.list();
    await codex.shutdown();
    commands.shutdown();
    await Promise.all(activeSessions.flatMap((session) => [files.unwatch(session.id), git.unwatch(session.id)]));
  };

  for (const session of await sessions.list()) {
    files.watch(session.id, session.cwd);
    git.watch(session.id, session.cwd, events);
  }

  app.use(express.json({ limit: "5mb" }));
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
  const app = await createApp({ host, port, previewPortStart, previewPortEnd });
  const auth = app.locals.auth as AuthManager | undefined;
  let server: ReturnType<typeof app.listen>;
  app.post("/api/shutdown", (req, res) => {
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress || "")) {
      res.status(403).json({ error: "Shutdown is only allowed from localhost." });
      return;
    }
    res.json({ ok: true });
    setTimeout(() => {
      void app.locals.cleanup?.().finally(() => server.close(() => process.exit(0)));
    }, 25);
  });
  return new Promise<{ host: string; port: number; auth?: AuthState; close(): Promise<void> }>((resolve) => {
    server = app.listen(port, host, () => {
      resolve({
        host,
        port,
        auth: auth?.getStatus(),
        close: async () => {
          await app.locals.cleanup?.();
          await new Promise<void>((done, reject) => {
            server.close((error) => (error ? reject(error) : done()));
          });
        },
      });
    });
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
