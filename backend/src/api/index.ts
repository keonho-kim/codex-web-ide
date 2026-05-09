import type { Express } from "express";
import type { AppServices } from "./context";
import { registerCodexRoutes } from "./codexRoutes";
import { registerCommandRoutes } from "./commandRoutes";
import { registerFileRoutes } from "./fileRoutes";
import { registerGitRoutes } from "./gitRoutes";
import { registerMentionRoutes } from "./mentionRoutes";
import { registerPreviewProxy } from "./previewProxy";
import { registerSessionRoutes } from "./sessionRoutes";
import { registerTerminalRoutes } from "./terminalRoutes";
import { registerWorkspaceRoutes } from "./workspaceRoutes";

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
