import { useQueryClient } from "@tanstack/react-query";
import { BottomPanel } from "./features/BottomPanel";
import { ProjectCreator, SessionCreator, Sidebar } from "./features/projects/ProjectControls";
import { Workbench } from "./features/Workbench";
import { useAppData } from "./features/app/useAppData";
import { useSessionEvents } from "./features/app/useSessionEvents";
import { cn } from "./lib/classes";
import { useUiStore } from "./store/uiStore";

export function App() {
  const queryClient = useQueryClient();
  const app = useAppData();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  useSessionEvents(app.activeSessionId, queryClient);

  return (
    <main
      className={cn(
        "grid h-screen grid-rows-[48px_minmax(0,1fr)_230px] bg-page text-ink max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_150px_minmax(0,1fr)_220px]",
        sidebarCollapsed ? "grid-cols-[44px_minmax(0,1fr)]" : "grid-cols-[230px_minmax(0,1fr)]",
      )}
    >
      <header className="col-span-full flex items-center justify-between gap-4 border-b border-hairline bg-canvas px-3 max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-2 max-[900px]:p-2">
        <div className="min-w-0">
          <strong className="block text-sm">Codex Web IDE</strong>
          <span className="block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">{app.activeSession?.cwd || "No session selected"}</span>
        </div>
        <div className="flex items-center gap-2 max-[900px]:flex-wrap max-[900px]:items-stretch">
          <ProjectCreator onCreated={(project) => app.selectProject(project.id)} />
          <SessionCreator projectId={app.activeProjectId} onCreated={(session) => app.setActiveSessionId(session.id)} />
        </div>
      </header>

      <Sidebar
        projects={app.orderedProjects}
        sessions={app.sessions}
        activeProjectId={app.activeProjectId}
        activeSessionId={app.activeSessionId}
        onProjectSelect={app.selectProject}
        onSessionSelect={app.setActiveSessionId}
        onSessionDelete={(id) => {
          if (confirm("Delete this session?")) app.deleteSession(id);
        }}
        settings={app.settings}
        onSettingsSave={app.updateSettings}
        settingsPending={app.settingsPending}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <Workbench sessionId={app.activeSessionId} />

      <BottomPanel sessionId={app.activeSessionId} />
    </main>
  );
}
