import { useQueryClient } from "@tanstack/react-query";
import { ListFilter, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "../../components/SectionTitle";
import type { Project, Session, WorkspaceSettings } from "../../lib/types";
import { api } from "../../lib/api";
import { AddProjectDialog } from "./AddProjectDialog";
import { ProjectThreadTree } from "./ProjectThreadTree";

export function Sidebar({
  projects,
  sessions,
  activeProjectId,
  activeSessionId,
  onProjectDelete,
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
  onProjectDelete(id: string): void;
  onProjectSelect(id: string): void;
  onSessionSelect(id: string): void;
  onSessionDelete(id: string): void;
  settings?: WorkspaceSettings;
  onSettingsSave(settings: WorkspaceSettings): void;
  settingsPending?: boolean;
  collapsed: boolean;
  onCollapsedChange(collapsed: boolean): void;
}) {
  const queryClient = useQueryClient();
  const ensureProjectSession = async (project: Project) => {
    const session = findProjectSession(project, sessions) ?? (await api<Session>("/api/sessions", { method: "POST", body: { projectId: project.id } }));
    onProjectSelect(project.id);
    onSessionSelect(session.id);
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  if (collapsed) {
    return (
      <aside className="flex h-full min-w-0 flex-col items-center justify-start gap-3 overflow-hidden rounded-lg border border-hairline bg-panel p-2" data-testid="sidebar">
        <Button aria-label="Expand sidebar" title="Expand sidebar" type="button" onClick={() => onCollapsedChange(false)} variant="ghost" size="icon-sm">
          <PanelLeftOpen data-icon="inline-start" />
        </Button>
        <AddProjectDialog
          compact
          defaultProjectsDir={settings?.defaultProjectsDir}
          onProjectSelect={onProjectSelect}
          onSessionSelect={onSessionSelect}
          sessions={sessions}
        />
        <div className="grid gap-1">
          {projects.map((project) => (
            <button
              className={`flex size-8 items-center justify-center rounded-md text-xs font-semibold ${
                project.id === activeProjectId ? "border border-selected-border bg-selected text-primary" : "text-muted hover:bg-canvas hover:text-ink"
              }`}
              key={project.id}
              title={project.name}
              type="button"
              onClick={() => void ensureProjectSession(project)}
            >
              {projectInitial(project.name)}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-full min-w-0 overflow-auto rounded-lg border border-hairline bg-panel p-3 max-[900px]:p-3" data-testid="sidebar">
      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1">
          <SectionTitle label="Threads" />
          <Button aria-label="Filter threads" title="Filter threads" type="button" variant="ghost" size="icon-sm">
            <ListFilter data-icon="inline-start" />
          </Button>
          <Button aria-label="Collapse sidebar" title="Collapse sidebar" type="button" onClick={() => onCollapsedChange(true)} variant="ghost" size="icon-sm">
            <PanelLeftClose data-icon="inline-start" />
          </Button>
        </div>
        <ProjectThreadTree
          projects={projects}
          sessions={sessions}
          activeProjectId={activeProjectId}
          activeSessionId={activeSessionId}
          onProjectDelete={onProjectDelete}
          onProjectSelect={onProjectSelect}
          onSessionSelect={onSessionSelect}
        />
        <AddProjectDialog defaultProjectsDir={settings?.defaultProjectsDir} onProjectSelect={onProjectSelect} onSessionSelect={onSessionSelect} sessions={sessions} />
      </div>
    </aside>
  );
}

function findProjectSession(project: Project, sessions: Session[]) {
  return sessions
    .filter((session) => session.projectId === project.id || session.cwd === project.cwd || session.cwd.startsWith(`${project.cwd.replace(/\/+$/, "")}/`))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
}

function projectInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}
