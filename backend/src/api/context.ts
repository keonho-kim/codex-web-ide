import type { NextFunction, Request, Response } from "express";
import type { EventBus } from "../events/eventBus";
import type { CodexManager } from "../managers/codexManager";
import type { CommandManager } from "../managers/commandManager";
import type { FileManager } from "../managers/fileManager";
import type { GitManager } from "../managers/gitManager";
import type { SessionManager } from "../managers/sessionManager";
import type { SkillManager } from "../managers/skillManager";
import type { WorkspaceManager } from "../managers/workspaceManager";
import type { PlatformAdapter } from "../platform/adapter";
import type { AuthManager } from "../auth/authManager";

export type AppServices = {
  events: EventBus;
  workspace: WorkspaceManager;
  sessions: SessionManager;
  files: FileManager;
  git: GitManager;
  skills: SkillManager;
  codex: CodexManager;
  commands: CommandManager;
  adapter: PlatformAdapter;
  auth: AuthManager;
};

export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<void> | void,
) {
  return (req: T, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function withSession(
  sessions: SessionManager,
  handler: (req: Request, res: Response, session: Awaited<ReturnType<SessionManager["get"]>>) => Promise<void> | void,
) {
  return asyncHandler(async (req, res) => {
    const session = await sessions.get(req.params.id);
    await handler(req, res, session);
  });
}

export function zodFileList(body: unknown) {
  if (typeof body !== "object" || !body || !("files" in body) || !Array.isArray(body.files)) {
    throw new Error("Expected { files: string[] }");
  }
  if (!body.files.every((file) => typeof file === "string")) throw new Error("Expected { files: string[] }");
  return body.files;
}
