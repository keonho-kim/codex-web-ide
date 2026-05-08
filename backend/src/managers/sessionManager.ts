import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { Session } from "../shared/types";
import type { WorkspaceManager } from "./workspaceManager";
import { JsonStore } from "./storage";
import { safeFsPath } from "./files/path";

export class SessionManager {
  constructor(
    private store: JsonStore,
    private workspace: WorkspaceManager,
  ) {}

  async list(): Promise<Session[]> {
    return this.store.read("sessions.json", []);
  }

  async create(input: { projectId?: string; cwd?: string; name?: string }) {
    const project = input.projectId ? await this.workspace.findProject(input.projectId) : null;
    if (input.projectId && !project) throw new Error("Project not found");
    const cwd = await fs.realpath(project ? await safeFsPath(project.cwd, input.cwd || ".") : path.resolve(input.cwd || process.cwd()));
    const stat = await fs.stat(cwd);
    if (!stat.isDirectory()) throw new Error("Session cwd must be a directory");
    const now = Date.now();
    const session: Session = {
      id: nanoid(),
      projectId: project?.id,
      cwd,
      name: input.name || project?.name || path.basename(cwd) || cwd,
      createdAt: now,
      lastActiveAt: now,
      status: "idle",
    };
    await this.store.write("sessions.json", [session, ...(await this.list())]);
    return session;
  }

  async get(id: string) {
    const session = (await this.list()).find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    return session;
  }

  async update(id: string, patch: Partial<Session>) {
    const sessions = await this.list();
    const next = sessions.map((item) => (item.id === id ? { ...item, ...patch, lastActiveAt: Date.now() } : item));
    await this.store.write("sessions.json", next);
    return next.find((item) => item.id === id)!;
  }

  async delete(id: string) {
    await this.store.write(
      "sessions.json",
      (await this.list()).filter((item) => item.id !== id),
    );
  }
}
