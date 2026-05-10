import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { workspaceSettingsSchema } from "../shared/schemas";
import type { LocalPathListing, Project, Session, WorkspaceSettings } from "../shared/types";
import { createPlatformAdapter } from "../platform/adapter";
import { expandUserPath } from "./files/path";
import { isForbiddenProjectEntry, isInsideRoot, resolveProjectRoot } from "./projects/pathPolicy";
import { JsonStore } from "./storage";

export class WorkspaceManager {
  private adapter = createPlatformAdapter();

  constructor(private store: JsonStore) {}

  async getSettings(): Promise<WorkspaceSettings> {
    const defaultAuth = {
      enabled: false,
      provider: "telegram" as const,
      singleSession: true,
      loginRequestTtlMs: 120000,
      heartbeatIntervalMs: 15000,
      sessionStaleMs: 90000,
      sessionIdleTimeoutMs: 1800000,
      sessionAbsoluteTtlMs: 43200000,
    };
    const fallback: WorkspaceSettings = {
      host: "127.0.0.1",
      port: 17321,
      previewPortStart: 17330,
      previewPortEnd: 17399,
      defaultProjectsDir: "~",
      activeProjectId: undefined,
      recentProjectIds: [],
      auth: defaultAuth,
      telegram: { remoteControlEnabled: false },
    };
    const settings = await this.store.read<Partial<WorkspaceSettings>>("config.json", fallback);
    return workspaceSettingsSchema.parse({
      ...fallback,
      ...settings,
      recentProjectIds: settings.recentProjectIds ?? fallback.recentProjectIds,
      auth: { ...defaultAuth, ...settings.auth },
      telegram: { ...fallback.telegram, ...settings.telegram },
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
    const cwd = await resolveProjectRoot(input.cwd);
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

  async repairPersistedState() {
    const projects = await this.listProjects();
    const repairedProjects: Project[] = [];
    const removedProjects: Array<{ id: string; cwd: string; reason: string }> = [];
    const seenProjectRoots = new Set<string>();

    for (const project of projects) {
      try {
        const cwd = await resolveProjectRoot(project.cwd);
        if (seenProjectRoots.has(cwd)) {
          removedProjects.push({ id: project.id, cwd: project.cwd, reason: "duplicate canonical path" });
          continue;
        }
        seenProjectRoots.add(cwd);
        repairedProjects.push({ ...project, cwd, name: project.name || path.basename(cwd) || cwd });
      } catch (error) {
        removedProjects.push({ id: project.id, cwd: project.cwd, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    const projectById = new Map(repairedProjects.map((project) => [project.id, project]));
    const sessions = await this.store.read<Session[]>("sessions.json", []);
    const repairedSessions: Session[] = [];
    const removedSessions: Array<{ id: string; cwd: string; reason: string }> = [];

    for (const session of sessions) {
      try {
        const project = session.projectId ? projectById.get(session.projectId) : null;
        if (session.projectId && !project) {
          removedSessions.push({ id: session.id, cwd: session.cwd, reason: "missing project" });
          continue;
        }
        const cwd = await resolveProjectRoot(session.cwd);
        if (project && !isInsideRoot(cwd, project.cwd)) {
          removedSessions.push({ id: session.id, cwd: session.cwd, reason: "session path is outside project" });
          continue;
        }
        repairedSessions.push({ ...session, cwd, name: session.name || project?.name || path.basename(cwd) || cwd });
      } catch (error) {
        removedSessions.push({ id: session.id, cwd: session.cwd, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    if (removedProjects.length > 0 || repairedProjects.some((project, index) => project.cwd !== projects[index]?.cwd)) {
      await this.store.write("projects.json", repairedProjects);
    }
    if (removedSessions.length > 0 || repairedSessions.some((session, index) => session.cwd !== sessions[index]?.cwd)) {
      await this.store.write("sessions.json", repairedSessions);
    }
    const settings = await this.getSettings();
    const validIds = new Set(repairedProjects.map((project) => project.id));
    const nextSettings = {
      ...settings,
      activeProjectId: settings.activeProjectId && validIds.has(settings.activeProjectId) ? settings.activeProjectId : undefined,
      recentProjectIds: settings.recentProjectIds.filter((id) => validIds.has(id)),
    };
    if (nextSettings.activeProjectId !== settings.activeProjectId || nextSettings.recentProjectIds.length !== settings.recentProjectIds.length) {
      await this.updateSettings({
        ...nextSettings,
      });
    }

    return { removedProjects, removedSessions };
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
      .filter((entry) => !entry.isDirectory || !isForbiddenProjectEntry(entry.path))
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
