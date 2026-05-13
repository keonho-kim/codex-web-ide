import type { Express } from "express";
import { codexRunSchema, codexSlashCommandSchema, createCodexThreadSchema } from "@backend/shared/schemas";
import { asyncHandler, type AppServices, withSession } from "@backend/api/context";

export function registerCodexRoutes(app: Express, { codex, sessions }: AppServices) {
  app.get("/api/codex/slash-commands", asyncHandler(async (_req, res) => {
    res.json(await codex.slashCommands());
  }));
  app.get("/api/codex/runtime-defaults", asyncHandler(async (_req, res) => {
    res.json(codex.runtimeDefaults());
  }));
  app.get("/api/sessions/:id/codex/messages", withSession(sessions, async (_req, res, session) => {
    res.json(await codex.listMessages(session));
  }));
  app.get("/api/sessions/:id/codex/status", withSession(sessions, async (_req, res, session) => {
    res.json(await codex.status(session));
  }));
  app.get("/api/sessions/:id/codex/threads", withSession(sessions, async (_req, res, session) => {
    res.json(await codex.listThreads(session));
  }));
  app.post("/api/sessions/:id/codex/threads", withSession(sessions, async (req, res, session) => {
    const body = createCodexThreadSchema.parse(req.body);
    res.status(201).json(await codex.createThread(session, body.title));
  }));
  app.post("/api/sessions/:id/codex/threads/:threadId/select", withSession(sessions, async (req, res, session) => {
    res.json(await codex.selectThread(session, req.params.threadId));
  }));
  app.delete("/api/sessions/:id/codex/threads/:threadId", withSession(sessions, async (req, res, session) => {
    res.json(await codex.deleteThread(session, req.params.threadId));
  }));
  app.post("/api/sessions/:id/codex/run", withSession(sessions, async (req, res, session) => {
    res.status(202).json(await codex.run(session, codexRunSchema.parse(req.body)));
  }));
  app.post("/api/sessions/:id/codex/slash-command", withSession(sessions, async (req, res, session) => {
    res.json(await codex.runSlashCommand(session, codexSlashCommandSchema.parse(req.body)));
  }));
  app.post("/api/sessions/:id/codex/cancel", withSession(sessions, async (_req, res, session) => {
    res.json(codex.cancel(session.id));
  }));
  app.post("/api/sessions/:id/codex/resume", withSession(sessions, async (_req, res, session) => {
    res.json(await codex.resume(session));
  }));
  app.get("/api/sessions/:id/codex/events", withSession(sessions, async (req, res) => {
    res.redirect(307, `/api/sessions/${req.params.id}/events`);
  }));
}
