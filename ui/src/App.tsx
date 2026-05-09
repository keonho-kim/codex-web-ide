import { useQueryClient } from "@tanstack/react-query";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { PreviewSheet } from "./features/preview/PreviewSheet";
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
        "grid h-screen gap-3 overflow-hidden bg-page p-3 text-ink max-[700px]:gap-2 max-[700px]:p-2",
        "grid-rows-[64px_minmax(0,1fr)] max-[900px]:grid-rows-[auto_minmax(0,1fr)]",
      )}
    >
      <Topbar
        activeSession={app.activeSession}
      />

      <PanelGroup className="min-h-0" direction="horizontal">
        <Panel defaultSize={sidebarCollapsed ? 10 : 28} minSize={sidebarCollapsed ? 9 : 22} maxSize={sidebarCollapsed ? 12 : 40}>
          <Sidebar
            projects={app.orderedProjects}
            sessions={app.allSessions}
            activeProjectId={app.activeProjectId}
            activeSessionId={app.activeSessionId}
            onProjectDelete={(id) => {
              if (confirm("Remove this project?")) app.deleteProject(id);
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
        </Panel>
        {!sidebarCollapsed ? <PanelResizeHandle className="w-2 bg-page transition-colors hover:bg-selected-border" /> : null}
        <Panel minSize={50}>
          <Workbench sessionId={app.activeSessionId} />
        </Panel>
      </PanelGroup>
      <PreviewSheet sessionId={app.activeSessionId} />
    </main>
  );
}
