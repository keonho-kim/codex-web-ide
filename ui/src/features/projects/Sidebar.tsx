import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
import type { Project, Session, WorkspaceSettings } from "../../lib/types";
import { ProjectList } from "./ProjectList";
import { SessionList } from "./SessionList";
import { SkillList } from "./SkillList";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";

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
