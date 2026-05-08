import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
import { buttonClass, inputClass } from "../../components/uiClasses";
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
      <SectionTitle label="Skills" />
      <SkillList sessionId={activeSessionId} />
      <SectionTitle label="Settings" />
      <WorkspaceSettingsPanel settings={settings} onSave={onSettingsSave} pending={settingsPending} />
    </aside>
  );
}
