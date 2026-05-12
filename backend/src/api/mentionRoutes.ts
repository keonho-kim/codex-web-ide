import type { Express } from "express";
import { type AppServices, withSession } from "@backend/api/context";

export function registerMentionRoutes(app: Express, { files, sessions, skills }: AppServices) {
  app.get("/api/sessions/:id/mentions/files", withSession(sessions, async (req, res, session) => {
    res.json(await files.search(session.cwd, String(req.query.q || "")));
  }));
  app.get("/api/sessions/:id/mentions/skills", withSession(sessions, async (req, res, session) => {
    res.json(await skills.search(session.cwd, String(req.query.q || "")));
  }));
}
