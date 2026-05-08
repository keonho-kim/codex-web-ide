import type { Express } from "express";
import {
  createFileSchema,
  deleteFileSchema,
  relativePathSchema,
  renameFileSchema,
  writeFileSchema,
} from "../shared/schemas";
import { type AppServices, withSession } from "./context";

export function registerFileRoutes(app: Express, { files, sessions }: AppServices) {
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
}
