import type { Express } from "express";
import { codexRunSchema } from "../shared/schemas";
import { type AppServices, withSession } from "./context";

export function registerCodexRoutes(app: Express, { codex, sessions }: AppServices) {
  app.get("/api/sessions/:id/codex/messages", withSession(sessions, async (_req, res, session) => {
    res.json(codex.listMessages(session.id));
  }));
  app.post("/api/sessions/:id/codex/run", withSession(sessions, async (req, res, session) => {
    res.status(202).json(await codex.run(session, codexRunSchema.parse(req.body)));
  }));
  app.post("/api/sessions/:id/codex/cancel", withSession(sessions, async (_req, res, session) => {
    res.json(codex.cancel(session.id));
  }));
  app.post("/api/sessions/:id/codex/resume", withSession(sessions, async (_req, res, session) => {
    res.json(codex.resume(session.id));
  }));
  app.get("/api/sessions/:id/codex/events", withSession(sessions, async (req, res) => {
    res.redirect(307, `/api/sessions/${req.params.id}/events`);
  }));
}
