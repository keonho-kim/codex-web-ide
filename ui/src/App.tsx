import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FolderGit2 } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AuthGate } from "@/features/auth/AuthGate";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/features/projects/Sidebar";
import { Topbar } from "@/features/app/Topbar";
import { useCodexTheme } from "@/features/app/useCodexTheme";
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
  const workbenchLayout = useUiStore((state) => state.workbenchLayout);
  const setWorkbenchLayout = useUiStore((state) => state.setWorkbenchLayout);
  const workbenchTab = normalizeWorkbenchTab(useUiStore((state) => state.workbenchTab));
  const setWorkbenchTab = useUiStore((state) => state.setWorkbenchTab);
  const compact = useMediaQuery("(max-width: 1100px)");
  useCodexTheme();
  const sessionEventIds = useMemo(
    () =>
      app.allSessions
        .filter((session) => session.status === "running")
        .map((session) => session.id)
        .sort(),
    [app.allSessions],
  );
  const expandedSidebarSize = clampSize(workbenchLayout[0], compact ? 28 : 24, compact ? 20 : 16, compact ? 42 : 34);
  const sidebarSize = sidebarCollapsed
    ? compact
      ? { defaultSize: 16, minSize: 16, maxSize: 18 }
      : { defaultSize: 4, minSize: 4, maxSize: 5 }
    : compact
      ? { defaultSize: expandedSidebarSize, minSize: 20, maxSize: 42 }
      : { defaultSize: expandedSidebarSize, minSize: 16, maxSize: 34 };

  useSessionEvents(sessionEventIds, queryClient);

  return (
    <AuthGate>
      <main
      className={cn(
        "grid min-h-[100dvh] gap-3 overflow-x-hidden bg-page p-3 text-ink max-[700px]:gap-2 max-[700px]:p-2",
        "grid-rows-[auto_minmax(0,1fr)] min-[1101px]:h-[100dvh] min-[1101px]:overflow-hidden",
      )}
    >
      <Topbar
        activeSession={app.activeSession}
        projectNavigationSlot={
          compact ? (
            <ProjectNavigationSheet
              activeProjectId={app.activeProjectId}
              activeSessionId={app.activeSessionId}
              onProjectDelete={(id) => {
                if (confirm("Remove this project?")) app.deleteProject(id);
              }}
              onProjectSelect={app.selectProject}
              onSessionDelete={app.deleteSession}
              onSessionSelect={app.setActiveSessionId}
              projects={app.orderedProjects}
              sessions={app.allSessions}
              settings={app.settings}
              settingsPending={app.settingsPending}
              onSettingsSave={app.updateSettings}
            />
          ) : null
        }
        workbenchTab={workbenchTab}
        onWorkbenchTabChange={(tab: WorkbenchTab) => setWorkbenchTab(tab)}
      />

      {compact ? (
        <div className="grid min-h-0">
          <Workbench activeProjectId={app.activeProjectId} onSessionCreated={app.setActiveSessionId} sessionId={app.activeSessionId} />
        </div>
      ) : (
        <PanelGroup
          className="h-full min-h-0"
          direction="horizontal"
          key={`${sidebarCollapsed ? "collapsed" : "expanded"}-${compact ? "compact" : "wide"}`}
          onLayout={(layout) => {
            if (!sidebarCollapsed && !compact && layout[0] >= 16) setWorkbenchLayout([Math.round(layout[0]), Math.round(layout[1] ?? 100 - layout[0])]);
          }}
        >
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

type ProjectNavigationSheetProps = Omit<Parameters<typeof Sidebar>[0], "collapsed" | "onCollapsedChange" | "stacked">;

function ProjectNavigationSheet({
  activeProjectId,
  activeSessionId,
  onProjectDelete,
  onProjectSelect,
  onSessionDelete,
  onSessionSelect,
  projects,
  sessions,
  settings,
  onSettingsSave,
  settingsPending,
}: ProjectNavigationSheetProps) {
  const [open, setOpen] = useState(false);
  const closeAfter = <T extends unknown[]>(callback: (...args: T) => void) =>
    (...args: T) => {
      callback(...args);
      setOpen(false);
    };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button aria-label="Open project navigator" title="Projects" className="hidden max-[1100px]:inline-flex" variant="outline" size="icon-sm" type="button">
          <FolderGit2 data-icon="inline-start" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(92vw,420px)] border-hairline bg-page p-3" side="left">
        <SheetHeader className="p-0 pr-8">
          <SheetTitle className="text-sm text-ink">Projects</SheetTitle>
          <SheetDescription className="sr-only">Select a project or thread for the active workspace.</SheetDescription>
        </SheetHeader>
        <Sidebar
          activeProjectId={activeProjectId}
          activeSessionId={activeSessionId}
          collapsed={false}
          onCollapsedChange={() => setOpen(false)}
          onProjectDelete={onProjectDelete}
          onProjectSelect={closeAfter(onProjectSelect)}
          onSessionDelete={onSessionDelete}
          onSessionSelect={closeAfter(onSessionSelect)}
          projects={projects}
          sessions={sessions}
          settings={settings}
          settingsPending={settingsPending}
          stacked
          onSettingsSave={onSettingsSave}
        />
      </SheetContent>
    </Sheet>
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

function clampSize(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
