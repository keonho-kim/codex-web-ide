import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PanelLeftClose, PanelLeftOpen, Play, Plus } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
import { api } from "../../lib/api";
import type { Project, Session, WorkspaceSettings } from "../../lib/types";
import { ProjectList } from "./ProjectList";
import { SessionList } from "./SessionList";
import { SkillList } from "./SkillList";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";

export function ProjectCreator({ onCreated }: { onCreated(project: Project): void }) {
  const queryClient = useQueryClient();
  const [cwd, setCwd] = useState("");
  const createProject = useMutation({
    mutationFn: (body: { cwd: string }) => api<Project>("/api/projects", { method: "POST", body }),
    onSuccess: async (project) => {
      onCreated(project);
      setCwd("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (cwd.trim()) createProject.mutate({ cwd: cwd.trim() });
      }}
    >
      <input
        className="w-[260px] min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
        value={cwd}
        onChange={(event) => setCwd(event.target.value)}
        placeholder="Project path"
      />
      <button
        className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
        title="Add project"
        type="submit"
      >
        <Plus size={16} />
      </button>
    </form>
  );
}

export function SessionCreator({ projectId, onCreated }: { projectId?: string; onCreated(session: Session): void }) {
  const queryClient = useQueryClient();
  const createSession = useMutation({
    mutationFn: () => api<Session>("/api/sessions", { method: "POST", body: { projectId } }),
    onSuccess: async (session) => {
      onCreated(session);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
  return (
    <button
      className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
      title="Create session"
      type="button"
      onClick={() => createSession.mutate()}
      disabled={!projectId}
    >
      <Play size={16} />
      Session
    </button>
  );
}

export function Sidebar({
  projects,
  sessions,
  activeProjectId,
  activeSessionId,
  onProjectSelect,
  onSessionSelect,
  onSessionDelete,
  settings,
  onSettingsSave,
  settingsPending,
  collapsed,
  onCollapsedChange,
}: {
  projects: Project[];
  sessions: Session[];
  activeProjectId?: string;
  activeSessionId?: string;
  onProjectSelect(id: string): void;
  onSessionSelect(id: string): void;
  onSessionDelete(id: string): void;
  settings?: WorkspaceSettings;
  onSettingsSave(settings: WorkspaceSettings): void;
  settingsPending?: boolean;
  collapsed: boolean;
  onCollapsedChange(collapsed: boolean): void;
}) {
  if (collapsed) {
    return (
      <aside className="row-span-2 flex min-w-0 justify-center overflow-hidden border-r border-hairline bg-panel p-2 max-[900px]:row-auto max-[900px]:border-r-0 max-[900px]:border-b">
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Expand sidebar"
          type="button"
          onClick={() => onCollapsedChange(false)}
        >
          <PanelLeftOpen size={15} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="row-span-2 min-w-0 overflow-auto border-r border-hairline bg-panel p-3 max-[900px]:row-auto max-[900px]:border-r-0 max-[900px]:border-b">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle label="Projects" />
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Collapse sidebar"
          type="button"
          onClick={() => onCollapsedChange(true)}
        >
          <PanelLeftClose size={15} />
        </button>
      </div>
      <ProjectList projects={projects} activeId={activeProjectId} onSelect={onProjectSelect} />
      <SectionTitle label="Sessions" />
      <SessionList sessions={sessions} activeId={activeSessionId} onSelect={onSessionSelect} onDelete={onSessionDelete} />
      <SectionTitle label="Skills" />
      <SkillList sessionId={activeSessionId} />
      <SectionTitle label="Settings" />
      <WorkspaceSettingsPanel settings={settings} onSave={onSettingsSave} pending={settingsPending} />
    </aside>
  );
}
