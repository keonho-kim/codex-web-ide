import type { Express, Request, Response } from "express";
import { createSessionSchema } from "@backend/shared/schemas";
import { asyncHandler, type AppServices } from "@backend/api/context";

export function registerSessionRoutes(app: Express, { codex, commands, events, files, git, sessions, terminals }: AppServices) {
  app.get("/api/sessions", asyncHandler(async (_req, res) => {
    res.json(await sessions.list());
  }));
  app.post("/api/sessions", asyncHandler(async (req, res) => {
    const session = await sessions.create(createSessionSchema.parse(req.body));
    files.watch(session.id, session.cwd);
    git.watch(session.id, session.cwd, events);
    res.status(201).json(session);
  }));
  app.get("/api/sessions/events", asyncHandler(async (req, res) => {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      res.status(400).json({ error: "Session ids are required." });
      return;
    }
    await Promise.all(ids.map((id) => sessions.get(id)));
    openSessionEventStream(req, res, (listener) => {
      const unsubscribers = ids.map((id) => events.subscribe(id, listener, req.header("last-event-id")));
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    });
  }));
  app.get("/api/sessions/:id", asyncHandler(async (req, res) => {
    res.json(await sessions.get(req.params.id));
  }));
  app.delete("/api/sessions/:id", asyncHandler(async (req, res) => {
    await sessions.get(req.params.id);
    await Promise.all([
      codex.deleteSession(req.params.id),
      commands.deleteSession(req.params.id),
      terminals.deleteSession(req.params.id),
      files.unwatch(req.params.id),
      git.unwatch(req.params.id),
    ]);
    await sessions.delete(req.params.id);
    events.dispose(req.params.id);
    res.status(204).end();
  }));
  app.get("/api/sessions/:id/events", asyncHandler(async (req, res) => {
    await sessions.get(req.params.id);
    openSessionEventStream(req, res, (listener) => events.subscribe(req.params.id, listener, req.header("last-event-id")));
  }));
}

function openSessionEventStream(
  req: Request,
  res: Response,
  subscribe: (listener: (event: { id: string; type: string }) => void) => () => void,
) {
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
  unsubscribe = subscribe((event) => {
    writeEventChunk(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  req.on("close", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
}
