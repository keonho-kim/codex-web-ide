import type { Express } from "express";
import { commandRequestSchema } from "@backend/shared/schemas";
import { type AppServices, withSession } from "@backend/api/context";

export function registerCommandRoutes(app: Express, { commands, sessions }: AppServices) {
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
}
