import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "../../components/SectionTitle";
import type { Project, Session, WorkspaceSettings } from "../../lib/types";
import { ProjectList } from "./ProjectList";
import { SessionList } from "./SessionList";
import { SkillList } from "./SkillList";
import { ThreadList } from "./ThreadList";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";

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
  if (collapsed) {
    return (
      <aside className="row-span-2 flex min-w-0 justify-center overflow-hidden border-r border-hairline bg-panel p-2 max-[900px]:row-auto max-[900px]:border-r-0 max-[900px]:border-b max-[700px]:hidden">
        <Button title="Expand sidebar" type="button" onClick={() => onCollapsedChange(false)} variant="outline" size="icon-sm">
          <PanelLeftOpen data-icon="inline-start" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="row-span-2 min-w-0 overflow-auto border-r border-hairline bg-panel p-3 max-[900px]:row-auto max-[900px]:overflow-x-auto max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:p-2 max-[700px]:hidden">
      <div className="grid gap-3 max-[900px]:grid-flow-col max-[900px]:grid-cols-[190px_190px_210px_210px_260px] max-[900px]:items-start">
        <section className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle label="Projects" />
            <Button title="Collapse sidebar" type="button" onClick={() => onCollapsedChange(true)} variant="outline" size="icon-sm">
              <PanelLeftClose data-icon="inline-start" />
            </Button>
          </div>
          <ProjectList projects={projects} activeId={activeProjectId} onDelete={onProjectDelete} onSelect={onProjectSelect} />
        </section>
        <section className="min-w-0">
          <SectionTitle label="Sessions" />
          <SessionList sessions={sessions} activeId={activeSessionId} onSelect={onSessionSelect} onDelete={onSessionDelete} />
        </section>
        <section className="min-w-0">
          <SectionTitle label="Threads" />
          <ThreadList sessionId={activeSessionId} />
        </section>
        <section className="min-w-0">
          <SectionTitle label="Skills" />
          <SkillList sessionId={activeSessionId} />
        </section>
        <section className="min-w-0">
          <SectionTitle label="Settings" />
          <WorkspaceSettingsPanel settings={settings} onSave={onSettingsSave} pending={settingsPending} />
        </section>
      </div>
    </aside>
  );
}
