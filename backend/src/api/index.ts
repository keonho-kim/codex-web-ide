import type { Express } from "express";
import type { AppServices } from "@backend/api/context";
import { registerCodexRoutes } from "@backend/api/codexRoutes";
import { registerCommandRoutes } from "@backend/api/commandRoutes";
import { registerFileRoutes } from "@backend/api/fileRoutes";
import { registerGitRoutes } from "@backend/api/gitRoutes";
import { registerMentionRoutes } from "@backend/api/mentionRoutes";
import { registerPreviewProxy } from "@backend/api/previewProxy";
import { registerSessionRoutes } from "@backend/api/sessionRoutes";
import { registerTerminalRoutes } from "@backend/api/terminalRoutes";
import { registerWorkspaceRoutes } from "@backend/api/workspaceRoutes";

export function registerApiRoutes(app: Express, services: AppServices) {
  services.auth.registerRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, platform: services.adapter.platform, home: services.adapter.getHomeDir() });
  });

  registerWorkspaceRoutes(app, services);
  registerSessionRoutes(app, services);
  registerFileRoutes(app, services);
  registerMentionRoutes(app, services);
  registerCodexRoutes(app, services);
  registerCommandRoutes(app, services);
  registerTerminalRoutes(app, services);
  registerGitRoutes(app, services);
  registerPreviewProxy(app, services);
}
