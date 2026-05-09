import type { Express } from "express";
import { browsePathSchema, createBrowseFolderSchema, createProjectSchema, workspaceSettingsSchema } from "../shared/schemas";
import { authRequired } from "../auth/authManager";
import { asyncHandler, type AppServices } from "./context";

export function registerWorkspaceRoutes(app: Express, { auth, workspace }: AppServices) {
  app.get("/api/workspace/settings", asyncHandler(async (_req, res) => {
    res.json(await workspace.getSettings());
  }));
  app.put("/api/workspace/settings", asyncHandler(async (req, res) => {
    const parsed = workspaceSettingsSchema.parse(req.body);
    const next = authRequired(parsed.host)
      ? { ...parsed, auth: { ...parsed.auth, enabled: true } }
      : parsed;
    await auth.applySettings(next, false);
    await workspace.updateSettings(next);
    res.json(await workspace.getSettings());
  }));
  app.get("/api/projects", asyncHandler(async (_req, res) => {
    res.json(await workspace.listProjects());
  }));
  app.get("/api/projects/browse", asyncHandler(async (req, res) => {
    res.json(await workspace.browsePath(browsePathSchema.parse(req.query.path)));
  }));
  app.post("/api/projects/browse/folder", asyncHandler(async (req, res) => {
    res.status(201).json(await workspace.createBrowseFolder(createBrowseFolderSchema.parse(req.body)));
  }));
  app.post("/api/projects", asyncHandler(async (req, res) => {
    res.status(201).json(await workspace.addProject(createProjectSchema.parse(req.body)));
  }));
  app.post("/api/projects/:id/open", asyncHandler(async (req, res) => {
    res.json(await workspace.openProject(req.params.id));
  }));
  app.delete("/api/projects/:id", asyncHandler(async (req, res) => {
    res.json(await workspace.removeProject(req.params.id));
  }));
}
