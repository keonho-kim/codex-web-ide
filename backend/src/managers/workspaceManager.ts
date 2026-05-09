import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { workspaceSettingsSchema } from "../shared/schemas";
import type { LocalPathListing, Project, WorkspaceSettings } from "../shared/types";
import { createPlatformAdapter } from "../platform/adapter";
import { expandUserPath } from "./files/path";
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
      defaultProjectsDir: "~",
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
    const cwd = await fs.realpath(path.resolve(expandUserPath(input.cwd)));
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

  async removeProject(id: string) {
    const projects = await this.listProjects();
    const project = projects.find((item) => item.id === id);
    if (!project) throw new Error("Project not found");
    await this.store.write(
      "projects.json",
      projects.filter((item) => item.id !== id),
    );
    const settings = await this.getSettings();
    await this.updateSettings({
      ...settings,
      activeProjectId: settings.activeProjectId === id ? undefined : settings.activeProjectId,
      recentProjectIds: settings.recentProjectIds.filter((item) => item !== id),
    });
    return project;
  }

  async findProject(id: string) {
    return (await this.listProjects()).find((item) => item.id === id) ?? null;
  }

  async browsePath(input?: string): Promise<LocalPathListing> {
    const requested = input?.trim() || (await this.getSettings()).defaultProjectsDir || this.adapter.getHomeDir();
    const resolved = path.resolve(expandUserPath(requested));
    const stat = await fs.stat(resolved).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return null;
    });
    const baseInput = stat ? (stat.isDirectory() ? resolved : path.dirname(resolved)) : this.adapter.getHomeDir();
    const base = path.resolve(baseInput);
    const entries = await fs.readdir(base, { withFileTypes: true });
    const visible = entries
      .map((entry) => ({
        name: entry.name,
        path: path.join(base, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
    const parentPath = path.dirname(base) === base ? undefined : path.dirname(base);
    return { path: base, parentPath, entries: visible.slice(0, 800) };
  }

  async createBrowseFolder(input: { path: string; name: string }) {
    const base = path.resolve(expandUserPath(input.path));
    const stat = await fs.stat(base);
    if (!stat.isDirectory()) throw new Error("Browse path must be a directory");
    const target = path.join(base, input.name);
    await fs.mkdir(target, { recursive: false });
    return this.browsePath(target);
  }
}
