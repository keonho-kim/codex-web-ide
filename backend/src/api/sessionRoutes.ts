import type { Express } from "express";
import { createSessionSchema } from "../shared/schemas";
import { asyncHandler, type AppServices } from "./context";

export function registerSessionRoutes(app: Express, { events, files, git, sessions }: AppServices) {
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
}
