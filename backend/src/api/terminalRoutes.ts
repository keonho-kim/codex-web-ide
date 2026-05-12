import type { Express } from "express";
import { createTerminalSchema, resizeTerminalSchema } from "@backend/shared/schemas";
import { type AppServices, withSession } from "@backend/api/context";

export function registerTerminalRoutes(app: Express, { sessions, terminals }: AppServices) {
  app.get("/api/sessions/:id/terminals", withSession(sessions, async (_req, res, session) => {
    res.json(terminals.list(session.id));
  }));
  app.post("/api/sessions/:id/terminals", withSession(sessions, async (req, res, session) => {
    res.status(201).json(terminals.create(session, createTerminalSchema.parse(req.body)));
  }));
  app.post("/api/sessions/:id/terminals/:terminalId/resize", withSession(sessions, async (req, res, session) => {
    const body = resizeTerminalSchema.parse(req.body);
    res.json(terminals.resize(session.id, req.params.terminalId, body.cols, body.rows));
  }));
  app.delete("/api/sessions/:id/terminals/:terminalId", withSession(sessions, async (req, res, session) => {
    terminals.close(session.id, req.params.terminalId);
    res.status(204).end();
  }));
}
