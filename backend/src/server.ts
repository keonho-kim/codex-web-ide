import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerApiRoutes } from "./api";
import { EventBus } from "./events/eventBus";
import { CodexManager } from "./managers/codexManager";
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
};

export async function createApp() {
  const store = new JsonStore();
  await store.ensure();

  const events = new EventBus();
  const workspace = new WorkspaceManager(store);
  const sessions = new SessionManager(store, workspace);
  const files = new FileManager(events);
  const git = new GitManager();
  const services = {
    events,
    workspace,
    sessions,
    files,
    git,
    skills: new SkillManager(),
    codex: new CodexManager(events, git),
    commands: new CommandManager(events, git),
    adapter: createPlatformAdapter(),
  };
  const app = express();

  for (const session of await sessions.list()) {
    files.watch(session.id, session.cwd);
    git.watch(session.id, session.cwd, events);
  }

  app.use(express.json({ limit: "5mb" }));
  registerApiRoutes(app, services);
  serveStaticUi(app);
  app.use(errorHandler);

  return app;
}

export async function startServer(options: ServerOptions = {}) {
  const host = options.host || process.env.CODEX_WEB_HOST || "127.0.0.1";
  const port = options.port || Number(process.env.CODEX_WEB_PORT || 17321);
  const app = await createApp();
  let server: ReturnType<typeof app.listen>;
  app.post("/api/shutdown", (req, res) => {
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress || "")) {
      res.status(403).json({ error: "Shutdown is only allowed from localhost." });
      return;
    }
    res.json({ ok: true });
    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 25);
  });
  return new Promise<{ host: string; port: number; close(): Promise<void> }>((resolve) => {
    server = app.listen(port, host, () => {
      resolve({
        host,
        port,
        close: () =>
          new Promise<void>((done, reject) => {
            server.close((error) => (error ? reject(error) : done()));
          }),
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
