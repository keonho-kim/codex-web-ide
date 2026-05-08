import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { workspaceSettingsSchema } from "../shared/schemas";
import type { Project, WorkspaceSettings } from "../shared/types";
import { createPlatformAdapter } from "../platform/adapter";
import { JsonStore } from "./storage";

export class WorkspaceManager {
  private adapter = createPlatformAdapter();

  constructor(private store: JsonStore) {}

  async getSettings(): Promise<WorkspaceSettings> {
    const fallback: WorkspaceSettings = {
      host: "127.0.0.1",
      port: 17321,
      previewPortStart: 17330,
      previewPortEnd: 17399,
      defaultProjectsDir: this.adapter.getDefaultProjectsDir(),
      activeProjectId: undefined,
      recentProjectIds: [],
      auth: { enabled: false },
    };
    const settings = await this.store.read<Partial<WorkspaceSettings>>("config.json", fallback);
    return workspaceSettingsSchema.parse({
      ...fallback,
      ...settings,
      recentProjectIds: settings.recentProjectIds ?? fallback.recentProjectIds,
      auth: { ...fallback.auth, ...settings.auth },
    });
  }

  async updateSettings(settings: WorkspaceSettings) {
    const next = workspaceSettingsSchema.parse(settings);
    await this.store.write("config.json", next);
    return next;
  }

  async listProjects(): Promise<Project[]> {
    return this.store.read("projects.json", []);
  }

  async addProject(input: { cwd: string; name?: string }) {
    const cwd = path.resolve(input.cwd);
    const stat = await fs.stat(cwd);
    if (!stat.isDirectory()) throw new Error("Project path must be a directory");
    const projects = await this.listProjects();
    const existing = projects.find((project) => project.cwd === cwd);
    const project =
      existing ??
      ({
        id: nanoid(),
        cwd,
        name: input.name || path.basename(cwd) || cwd,
        lastOpenedAt: Date.now(),
      } satisfies Project);
    const next = existing
      ? projects.map((item) => (item.id === project.id ? { ...item, lastOpenedAt: Date.now() } : item))
      : [project, ...projects];
    await this.store.write("projects.json", next);
    return project;
  }

  async openProject(id: string) {
    const projects = await this.listProjects();
    const project = projects.find((item) => item.id === id);
    if (!project) throw new Error("Project not found");
    const settings = await this.getSettings();
    const recentProjectIds = [id, ...settings.recentProjectIds.filter((item) => item !== id)].slice(0, 20);
    await this.updateSettings({ ...settings, activeProjectId: id, recentProjectIds });
    await this.store.write(
      "projects.json",
      projects.map((item) => (item.id === id ? { ...item, lastOpenedAt: Date.now() } : item)),
    );
    return project;
  }

  async findProject(id: string) {
    return (await this.listProjects()).find((item) => item.id === id) ?? null;
  }
}
