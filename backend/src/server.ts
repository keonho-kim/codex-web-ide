import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProxyMiddleware } from "http-proxy-middleware";
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
import {
  codexRunSchema,
  commandRequestSchema,
  createFileSchema,
  createProjectSchema,
  createSessionSchema,
  deleteFileSchema,
  gitBranchSchema,
  gitCommitSchema,
  gitPathSchema,
  renameFileSchema,
  relativePathSchema,
  workspaceSettingsSchema,
  writeFileSchema,
} from "./shared/schemas";

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
  const skills = new SkillManager();
  const codex = new CodexManager(events, git);
  const commands = new CommandManager(events, git);
  const adapter = createPlatformAdapter();
  const app = express();

  for (const session of await sessions.list()) {
    files.watch(session.id, session.cwd);
    git.watch(session.id, session.cwd, events);
  }

  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, platform: adapter.platform, home: adapter.getHomeDir() });
  });

  app.get("/api/workspace/settings", asyncHandler(async (_req, res) => {
    res.json(await workspace.getSettings());
  }));
  app.put("/api/workspace/settings", asyncHandler(async (req, res) => {
    res.json(await workspace.updateSettings(workspaceSettingsSchema.parse(req.body)));
  }));
  app.get("/api/projects", asyncHandler(async (_req, res) => {
    res.json(await workspace.listProjects());
  }));
  app.post("/api/projects", asyncHandler(async (req, res) => {
    res.status(201).json(await workspace.addProject(createProjectSchema.parse(req.body)));
  }));
  app.post("/api/projects/:id/open", asyncHandler(async (req, res) => {
    res.json(await workspace.openProject(req.params.id));
  }));

  app.get("/api/sessions", asyncHandler(async (_req, res) => {
    res.json(await sessions.list());
  }));
  app.post("/api/sessions", asyncHandler(async (req, res) => {
    const session = await sessions.create(createSessionSchema.parse(req.body));
    files.watch(session.id, session.cwd);
    git.watch(session.id, session.cwd, events);
    res.status(201).json(session);
  }));
  app.get("/api/sessions/:id", asyncHandler(async (req, res) => {
    res.json(await sessions.get(req.params.id));
  }));
  app.delete("/api/sessions/:id", asyncHandler(async (req, res) => {
    await sessions.delete(req.params.id);
    res.status(204).end();
  }));
  app.get("/api/sessions/:id/events", asyncHandler(async (req, res) => {
    await sessions.get(req.params.id);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write("retry: 1000\n\n");
    const unsubscribe = events.subscribe(req.params.id, (event) => {
      res.write(`id: ${event.id}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    req.on("close", unsubscribe);
  }));

  app.get("/api/sessions/:id/files/tree", withSession(sessions, async (req, res, session) => {
    const inputPath = relativePathSchema.parse(req.query.path);
    res.json(await files.tree(session.cwd, inputPath));
  }));
  app.get("/api/sessions/:id/files/read", withSession(sessions, async (req, res, session) => {
    const inputPath = relativePathSchema.parse(req.query.path);
    res.json({ path: inputPath, content: await files.read(session.cwd, inputPath) });
  }));
  app.put("/api/sessions/:id/files/write", withSession(sessions, async (req, res, session) => {
    const body = writeFileSchema.parse(req.body);
    await files.write(session.cwd, body.path, body.content);
    res.json({ ok: true });
  }));
  app.post("/api/sessions/:id/files/create", withSession(sessions, async (req, res, session) => {
    const body = createFileSchema.parse(req.body);
    await files.create(session.cwd, body.path, body.isDirectory, body.content);
    res.status(201).json({ ok: true });
  }));
  app.post("/api/sessions/:id/files/rename", withSession(sessions, async (req, res, session) => {
    const body = renameFileSchema.parse(req.body);
    await files.rename(session.cwd, body.from, body.to);
    res.json({ ok: true });
  }));
  app.post("/api/sessions/:id/files/delete", withSession(sessions, async (req, res, session) => {
    const body = deleteFileSchema.parse(req.body);
    await files.delete(session.cwd, body.path);
    res.json({ ok: true });
  }));

  app.get("/api/sessions/:id/mentions/files", withSession(sessions, async (req, res, session) => {
    res.json(await files.search(session.cwd, String(req.query.q || "")));
  }));
  app.get("/api/sessions/:id/mentions/skills", withSession(sessions, async (req, res, session) => {
    res.json(await skills.search(session.cwd, String(req.query.q || "")));
  }));

  app.get("/api/sessions/:id/codex/messages", withSession(sessions, async (_req, res, session) => {
    res.json(codex.listMessages(session.id));
  }));
  app.post("/api/sessions/:id/codex/run", withSession(sessions, async (req, res, session) => {
    res.status(202).json(await codex.run(session, codexRunSchema.parse(req.body)));
  }));
  app.post("/api/sessions/:id/codex/cancel", withSession(sessions, async (_req, res, session) => {
    res.json(codex.cancel(session.id));
  }));
  app.post("/api/sessions/:id/codex/resume", withSession(sessions, async (_req, res) => {
    res.status(501).json({ error: "Codex resume is not implemented yet." });
  }));
  app.get("/api/sessions/:id/codex/events", withSession(sessions, async (req, res) => {
    res.redirect(307, `/api/sessions/${req.params.id}/events`);
  }));

  app.post("/api/sessions/:id/commands/job", withSession(sessions, async (req, res, session) => {
    const body = commandRequestSchema.parse(req.body);
    res.status(201).json(await commands.startJob(session, body.command, body));
  }));
  app.get("/api/sessions/:id/jobs", withSession(sessions, async (_req, res, session) => {
    res.json(commands.listJobs(session.id));
  }));
  app.get("/api/sessions/:id/jobs/:jobId", withSession(sessions, async (req, res, session) => {
    res.json(commands.getJob(session.id, req.params.jobId));
  }));
  app.post("/api/sessions/:id/jobs/:jobId/cancel", withSession(sessions, async (req, res, session) => {
    res.json(commands.cancelJob(session.id, req.params.jobId));
  }));

  app.post("/api/sessions/:id/commands/preview", withSession(sessions, async (req, res, session) => {
    const body = commandRequestSchema.parse(req.body);
    res.status(201).json(await commands.startPreview(session, body.command, body));
  }));
  app.get("/api/sessions/:id/previews", withSession(sessions, async (_req, res, session) => {
    res.json(commands.listPreviews(session.id));
  }));
  app.post("/api/sessions/:id/previews", withSession(sessions, async (req, res, session) => {
    const body = commandRequestSchema.parse(req.body);
    res.status(201).json(await commands.startPreview(session, body.command, body));
  }));
  app.post("/api/sessions/:id/previews/:previewId/stop", withSession(sessions, async (req, res, session) => {
    res.json(commands.stopPreview(session.id, req.params.previewId));
  }));
  app.post("/api/sessions/:id/previews/:previewId/restart", withSession(sessions, async (req, res, session) => {
    res.json(await commands.restartPreview(session, req.params.previewId));
  }));

  app.post("/api/sessions/:id/commands/service", withSession(sessions, async (req, res, session) => {
    const body = commandRequestSchema.parse(req.body);
    res.status(201).json(await commands.startService(session, body.command, body));
  }));
  app.get("/api/sessions/:id/services", withSession(sessions, async (_req, res, session) => {
    res.json(commands.listServices(session.id));
  }));
  app.post("/api/sessions/:id/services", withSession(sessions, async (req, res, session) => {
    const body = commandRequestSchema.parse(req.body);
    res.status(201).json(await commands.startService(session, body.command, body));
  }));
  app.post("/api/sessions/:id/services/:serviceId/stop", withSession(sessions, async (req, res, session) => {
    res.json(commands.stopService(session.id, req.params.serviceId));
  }));
  app.post("/api/sessions/:id/services/:serviceId/restart", withSession(sessions, async (req, res, session) => {
    res.json(await commands.restartService(session, req.params.serviceId));
  }));

  app.get("/api/sessions/:id/git/state", withSession(sessions, async (_req, res, session) => {
    res.json(await git.state(session.cwd));
  }));
  app.get("/api/sessions/:id/git/status", withSession(sessions, async (_req, res, session) => {
    res.json(await git.status(session.cwd));
  }));
  app.get("/api/sessions/:id/git/diff", withSession(sessions, async (req, res, session) => {
    const query = gitPathSchema.parse(req.query);
    res.json({ diff: await git.diff(session.cwd, query.path, false) });
  }));
  app.get("/api/sessions/:id/git/diff/staged", withSession(sessions, async (req, res, session) => {
    const query = gitPathSchema.parse(req.query);
    res.json({ diff: await git.diff(session.cwd, query.path, true) });
  }));
  app.post("/api/sessions/:id/git/stage", withSession(sessions, async (req, res, session) => {
    await git.stage(session.cwd, zodFileList(req.body));
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/unstage", withSession(sessions, async (req, res, session) => {
    await git.unstage(session.cwd, zodFileList(req.body));
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/commit", withSession(sessions, async (req, res, session) => {
    await git.commit(session.cwd, gitCommitSchema.parse(req.body).message);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/push", withSession(sessions, async (_req, res, session) => {
    await git.push(session.cwd);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/pull", withSession(sessions, async (_req, res, session) => {
    await git.pull(session.cwd);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/branch", withSession(sessions, async (_req, res, session) => {
    res.json(await git.branch(session.cwd));
  }));
  app.post("/api/sessions/:id/git/checkout", withSession(sessions, async (req, res, session) => {
    await git.checkout(session.cwd, gitBranchSchema.parse(req.body).branch);
    res.json(await git.state(session.cwd));
  }));
  app.post("/api/sessions/:id/git/create-and-checkout", withSession(sessions, async (req, res, session) => {
    await git.createAndCheckout(session.cwd, gitBranchSchema.parse(req.body).branch);
    res.json(await git.state(session.cwd));
  }));

  app.use(
    "/preview/:sessionId/:previewId",
    createProxyMiddleware({
      changeOrigin: true,
      ws: true,
      router: (req) => {
        const expressReq = req as Request;
        const sessionId = expressReq.params?.sessionId;
        const previewId = expressReq.params?.previewId;
        return typeof sessionId === "string" && typeof previewId === "string"
          ? commands.getPreviewTarget(sessionId, previewId) || "http://127.0.0.1:9"
          : "http://127.0.0.1:9";
      },
      pathRewrite: (_path, req) => {
        const expressReq = req as Request;
        const sessionId = expressReq.params?.sessionId;
        const previewId = expressReq.params?.previewId;
        if (typeof sessionId !== "string" || typeof previewId !== "string") return "/";
        return expressReq.originalUrl.replace(`/preview/${sessionId}/${previewId}`, "") || "/";
      },
    }),
  );

  const uiDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../ui/dist");
  app.use(express.static(uiDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(uiDist, "index.html"), (error) => {
      if (error) res.status(200).send("<!doctype html><title>Codex Web IDE</title><div id=\"root\">UI build not found. Run bun run build:web.</div>");
    });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  });

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

function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<void> | void,
) {
  return (req: T, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next);
}

function withSession(
  sessions: SessionManager,
  handler: (req: Request, res: Response, session: Awaited<ReturnType<SessionManager["get"]>>) => Promise<void> | void,
) {
  return asyncHandler(async (req, res) => {
    const session = await sessions.get(req.params.id);
    await handler(req, res, session);
  });
}

function zodFileList(body: unknown) {
  if (typeof body !== "object" || !body || !("files" in body) || !Array.isArray(body.files)) {
    throw new Error("Expected { files: string[] }");
  }
  if (!body.files.every((file) => typeof file === "string")) throw new Error("Expected { files: string[] }");
  return body.files;
}
