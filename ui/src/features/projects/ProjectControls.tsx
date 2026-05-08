import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCode2, Folder, Play, Plus, Trash2 } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
import { buttonClass, iconButtonClass, inputClass, mutedClass, selectedListButtonClass, transparentListButtonClass } from "../../components/uiClasses";
import { api } from "../../lib/api";
import type { Project, Session, WorkspaceSettings } from "../../lib/types";
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
      <input className={`${inputClass} w-[260px]`} value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder="Project path" />
      <button className={buttonClass} title="Add project" type="submit">
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
    <button className={buttonClass} title="Create session" type="button" onClick={() => createSession.mutate()} disabled={!projectId}>
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
}) {
  return (
    <aside className="row-span-2 min-w-0 overflow-auto border-r border-hairline bg-panel p-3 max-[900px]:row-auto max-[900px]:border-r-0 max-[900px]:border-b">
      <SectionTitle label="Projects" />
      <ProjectList projects={projects} activeId={activeProjectId} onSelect={onProjectSelect} />
      <SectionTitle label="Sessions" />
      <SessionList sessions={sessions} activeId={activeSessionId} onSelect={onSessionSelect} onDelete={onSessionDelete} />
      <SectionTitle label="Settings" />
      <WorkspaceSettingsPanel settings={settings} onSave={onSettingsSave} pending={settingsPending} />
    </aside>
  );
}

function ProjectList({ projects, activeId, onSelect }: { projects: Project[]; activeId?: string; onSelect(id: string): void }) {
  return (
    <nav className="grid gap-1">
      {projects.map((project) => (
        <button
          className={`${transparentListButtonClass} ${project.id === activeId ? selectedListButtonClass : ""}`}
          key={project.id}
          type="button"
          onClick={() => onSelect(project.id)}
        >
          <Folder size={15} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
        </button>
      ))}
      {projects.length === 0 ? <p className={mutedClass}>Add a local project path.</p> : null}
    </nav>
  );
}

function SessionList({ sessions, activeId, onSelect, onDelete }: { sessions: Session[]; activeId?: string; onSelect(id: string): void; onDelete(id: string): void }) {
  return (
    <nav className="grid gap-1">
      {sessions.map((session) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1" key={session.id}>
          <button
            className={`${transparentListButtonClass} ${session.id === activeId ? selectedListButtonClass : ""}`}
            type="button"
            onClick={() => onSelect(session.id)}
          >
            <FileCode2 size={15} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{session.name}</span>
          </button>
          <button className={iconButtonClass} title="Delete session" type="button" onClick={() => onDelete(session.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {sessions.length === 0 ? <p className={mutedClass}>Create a session to browse files.</p> : null}
    </nav>
  );
}
