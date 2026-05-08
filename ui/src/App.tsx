import { useQueryClient } from "@tanstack/react-query";
import { BottomPanel } from "./features/BottomPanel";
import { Sidebar } from "./features/projects/Sidebar";
import { Topbar } from "./features/app/Topbar";
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
        "app-shell",
        sidebarCollapsed ? "grid-cols-[44px_minmax(0,1fr)]" : "grid-cols-[230px_minmax(0,1fr)]",
      )}
    >
      <Topbar
        activeProjectId={app.activeProjectId}
        activeSession={app.activeSession}
        defaultProjectsDir={app.settings?.defaultProjectsDir}
        onProjectCreated={(project) => app.selectProject(project.id)}
        onSessionCreated={(session) => app.setActiveSessionId(session.id)}
      />

      <Sidebar
        projects={app.orderedProjects}
        sessions={app.sessions}
        activeProjectId={app.activeProjectId}
        activeSessionId={app.activeSessionId}
        onProjectDelete={(id) => {
          if (confirm("Remove this project from the workspace?")) app.deleteProject(id);
        }}
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
