import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AuthGate } from "@/features/auth/AuthGate";
import { Sidebar } from "@/features/projects/Sidebar";
import { Topbar } from "@/features/app/Topbar";
import { Workbench } from "@/features/Workbench";
import { useAppData } from "@/features/app/useAppData";
import { useSessionEvents } from "@/features/app/useSessionEvents";
import { cn } from "@/lib/classes";
import { normalizeWorkbenchTab, useUiStore, type WorkbenchTab } from "@/store/uiStore";

export function App() {
  const queryClient = useQueryClient();
  const app = useAppData();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const workbenchTab = normalizeWorkbenchTab(useUiStore((state) => state.workbenchTab));
  const setWorkbenchTab = useUiStore((state) => state.setWorkbenchTab);
  const compact = useMediaQuery("(max-width: 900px)");
  const stacked = useMediaQuery("(max-width: 700px)");
  const sessionEventIds = useMemo(
    () =>
      app.allSessions
        .filter((session) => session.status === "running")
        .map((session) => session.id)
        .sort(),
    [app.allSessions],
  );
  const sidebarSize = sidebarCollapsed
    ? compact
      ? { defaultSize: 16, minSize: 16, maxSize: 18 }
      : { defaultSize: 4, minSize: 4, maxSize: 5 }
    : compact
      ? { defaultSize: 28, minSize: 20, maxSize: 42 }
      : { defaultSize: 24, minSize: 16, maxSize: 34 };

  useSessionEvents(sessionEventIds, queryClient);

  return (
    <AuthGate>
      <main
      className={cn(
        "grid h-screen gap-3 overflow-hidden bg-page p-3 text-ink max-[700px]:gap-2 max-[700px]:p-2",
        "grid-rows-[64px_minmax(0,1fr)] max-[900px]:grid-rows-[auto_minmax(0,1fr)]",
      )}
    >
      <Topbar
        activeSession={app.activeSession}
        workbenchTab={workbenchTab}
        onWorkbenchTabChange={(tab: WorkbenchTab) => setWorkbenchTab(tab)}
      />

      {stacked ? (
        <div
          className={cn(
            "grid h-full min-h-0 gap-2",
            sidebarCollapsed ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(144px,30vh)_minmax(0,1fr)]",
          )}
        >
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
            onSessionDelete={app.deleteSession}
            settings={app.settings}
            onSettingsSave={app.updateSettings}
            settingsPending={app.settingsPending}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            stacked
          />
          <Workbench activeProjectId={app.activeProjectId} onSessionCreated={app.setActiveSessionId} sessionId={app.activeSessionId} />
        </div>
      ) : (
        <PanelGroup className="h-full min-h-0" direction="horizontal" key={`${sidebarCollapsed ? "collapsed" : "expanded"}-${compact ? "compact" : "wide"}`}>
          <Panel className="min-h-0" defaultSize={sidebarSize.defaultSize} minSize={sidebarSize.minSize} maxSize={sidebarSize.maxSize}>
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
              onSessionDelete={app.deleteSession}
              settings={app.settings}
              onSettingsSave={app.updateSettings}
              settingsPending={app.settingsPending}
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />
          </Panel>
          {!sidebarCollapsed ? <PanelResizeHandle className="w-2 bg-page transition-colors hover:bg-selected-border" /> : null}
          <Panel className="min-h-0" minSize={50}>
            <Workbench activeProjectId={app.activeProjectId} onSessionCreated={app.setActiveSessionId} sessionId={app.activeSessionId} />
          </Panel>
        </PanelGroup>
      )}
      </main>
    </AuthGate>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(query).matches));

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
