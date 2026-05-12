import { ListFilter, PanelLeftClose, PanelLeftOpen, PanelTopClose, PanelTopOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/classes";
import { SectionTitle } from "@/components/SectionTitle";
import type { Project, Session, WorkspaceSettings } from "@/lib/types";
import { AddProjectDialog } from "@/features/projects/AddProjectDialog";
import { ProjectThreadTree } from "@/features/projects/ProjectThreadTree";

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
  stacked = false,
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
  stacked?: boolean;
}) {
  const selectProject = (project: Project) => {
    onProjectSelect(project.id);
  };

  if (collapsed) {
    if (stacked) {
      return (
        <aside className="flex min-h-12 min-w-0 items-center gap-2 overflow-x-auto rounded-lg border border-hairline bg-panel p-2" data-testid="sidebar">
          <Button aria-label="Expand sidebar" title="Expand sidebar" type="button" onClick={() => onCollapsedChange(false)} variant="ghost" size="icon-sm">
            <PanelTopOpen data-icon="inline-start" />
          </Button>
          <AddProjectDialog compact defaultProjectsDir={settings?.defaultProjectsDir} onProjectSelect={onProjectSelect} />
          <div className="flex min-w-0 items-center gap-1">
            {projects.map((project) => (
              <button
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                  project.id === activeProjectId ? "border border-selected-border bg-selected text-primary" : "text-muted hover:bg-canvas hover:text-ink",
                )}
                key={project.id}
                title={project.name}
                type="button"
                onClick={() => selectProject(project)}
              >
                {projectInitial(project.name)}
              </button>
            ))}
          </div>
        </aside>
      );
    }
    return (
      <aside className="flex h-full min-w-0 flex-col items-center justify-start gap-3 overflow-hidden rounded-lg border border-hairline bg-panel p-2" data-testid="sidebar">
        <Button aria-label="Expand sidebar" title="Expand sidebar" type="button" onClick={() => onCollapsedChange(false)} variant="ghost" size="icon-sm">
          <PanelLeftOpen data-icon="inline-start" />
        </Button>
        <AddProjectDialog compact defaultProjectsDir={settings?.defaultProjectsDir} onProjectSelect={onProjectSelect} />
        <div className="grid gap-1">
          {projects.map((project) => (
            <button
              className={`flex size-8 items-center justify-center rounded-md text-xs font-semibold ${
                project.id === activeProjectId ? "border border-selected-border bg-selected text-primary" : "text-muted hover:bg-canvas hover:text-ink"
              }`}
              key={project.id}
              title={project.name}
              type="button"
              onClick={() => selectProject(project)}
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
            {stacked ? <PanelTopClose data-icon="inline-start" /> : <PanelLeftClose data-icon="inline-start" />}
          </Button>
        </div>
        <ProjectThreadTree
          projects={projects}
          sessions={sessions}
          activeProjectId={activeProjectId}
          activeSessionId={activeSessionId}
          onProjectDelete={onProjectDelete}
          onProjectSelect={onProjectSelect}
          onSessionDelete={onSessionDelete}
          onSessionSelect={onSessionSelect}
        />
        <AddProjectDialog defaultProjectsDir={settings?.defaultProjectsDir} onProjectSelect={onProjectSelect} />
      </div>
    </aside>
  );
}

function projectInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}
