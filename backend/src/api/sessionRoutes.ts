import type { Express } from "express";
import { createSessionSchema } from "../shared/schemas";
import { asyncHandler, type AppServices } from "./context";

export function registerSessionRoutes(app: Express, { codex, commands, events, files, git, sessions }: AppServices) {
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
    await sessions.get(req.params.id);
    await Promise.all([
      codex.deleteSession(req.params.id),
      commands.deleteSession(req.params.id),
      files.unwatch(req.params.id),
      git.unwatch(req.params.id),
    ]);
    await sessions.delete(req.params.id);
    events.dispose(req.params.id);
    res.status(204).end();
  }));
  app.get("/api/sessions/:id/events", asyncHandler(async (req, res) => {
    await sessions.get(req.params.id);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write("retry: 1000\n\n");
    res.write(": connected\n\n");
    let closed = false;
    let unsubscribe = () => {};
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    };
    const writeEventChunk = (chunk: string) => {
      if (closed || res.destroyed || res.writableEnded) return false;
      try {
        return res.write(chunk);
      } catch {
        cleanup();
        return false;
      }
    };
    heartbeat = setInterval(() => {
      writeEventChunk(": keepalive\n\n");
    }, 15000);
    unsubscribe = events.subscribe(
      req.params.id,
      (event) => {
        writeEventChunk(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      },
      req.header("last-event-id"),
    );
    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  }));
}
