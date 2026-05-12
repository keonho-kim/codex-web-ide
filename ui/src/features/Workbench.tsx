import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Files, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { normalizeWorkbenchTab, useUiStore, type WorkbenchTab } from "@/store/uiStore";
import { workbenchTabs } from "@/features/workbenchTabs";
import { CodexPane } from "@/features/codex/CodexPane";
import { FilePane } from "@/features/files/FilePane";

const ControlPane = lazy(() => import("@/features/control/ControlPane").then((module) => ({ default: module.ControlPane })));
const EditorPane = lazy(() => import("@/features/editor/EditorPane").then((module) => ({ default: module.EditorPane })));

export function Workbench({
  activeProjectId,
  onSessionCreated,
  sessionId,
}: {
  activeProjectId?: string;
  onSessionCreated(sessionId: string): void;
  sessionId?: string;
}) {
  const workbenchTab = normalizeWorkbenchTab(useUiStore((state) => state.workbenchTab));
  const setWorkbenchTab = useUiStore((state) => state.setWorkbenchTab);
  const editorFilesCollapsed = useUiStore((state) => state.editorFilesCollapsed);
  const setEditorFilesCollapsed = useUiStore((state) => state.setEditorFilesCollapsed);
  const stacked = useMediaQuery("(max-width: 1100px)");
  const activeTabLabel = useMemo(() => workbenchTabs.find((item) => item.id === workbenchTab)?.label ?? "Chat", [workbenchTab]);

  return (
    <section className="h-full min-h-0 overflow-hidden rounded-lg border border-hairline bg-canvas shadow-[0_18px_50px_rgb(32_38_39/0.08)] max-[1100px]:min-h-[calc(100dvh-112px)] max-[700px]:min-h-[calc(100dvh-164px)]" data-testid="workbench">
      <Tabs className="grid h-full min-h-0 grid-rows-[52px_minmax(0,1fr)] gap-0 max-[700px]:grid-rows-[44px_minmax(0,1fr)]" value={workbenchTab} onValueChange={(value) => setWorkbenchTab(value as WorkbenchTab)}>
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-hairline bg-panel px-4 py-2 max-[700px]:hidden">
          <TabsList className="h-9 bg-canvas" variant="default">
            {workbenchTabs.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger className="min-w-24 gap-2 px-3" key={item.id} value={item.id}>
                  <Icon data-icon="inline-start" />
                  {item.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <span className="truncate text-xs text-muted max-[700px]:hidden">{sessionId ? "One project view at a time" : "Select a project to begin"}</span>
        </div>
        <div className="hidden items-center justify-between border-b border-hairline bg-panel px-3 py-2 max-[700px]:flex">
          <span className="text-xs font-semibold text-ink">{activeTabLabel}</span>
          <span className="truncate pl-3 text-[11px] text-muted">{sessionId ? "Active project" : "No project selected"}</span>
        </div>
        <TabsContent className="min-h-0 overflow-hidden" value="chat">
          <CodexPane activeProjectId={activeProjectId} onSessionCreated={onSessionCreated} sessionId={sessionId} />
        </TabsContent>
        <TabsContent className="min-h-0 overflow-hidden" value="editor">
          {stacked ? (
            <CompactEditorPane sessionId={sessionId} />
          ) : (
            <PanelGroup className="h-full min-h-0 bg-canvas" direction="horizontal">
              {editorFilesCollapsed ? (
                <Panel defaultSize={5} minSize={4} maxSize={6}>
                  <div className="flex h-full flex-col items-center gap-2 border-r border-hairline bg-panel p-2">
                    <Button aria-label="Show files" title="Show files" type="button" variant="ghost" size="icon-sm" onClick={() => setEditorFilesCollapsed(false)}>
                      <PanelLeftOpen data-icon="inline-start" />
                    </Button>
                    <Files size={16} className="text-muted" />
                  </div>
                </Panel>
              ) : (
                <>
                  <Panel defaultSize={28} minSize={20}>
                    <div className="grid h-full min-h-0 grid-rows-[48px_minmax(0,1fr)]">
                      <div className="flex h-12 items-center justify-end border-b border-hairline bg-panel px-2">
                        <Button aria-label="Hide files" title="Hide files" type="button" variant="ghost" size="icon-sm" onClick={() => setEditorFilesCollapsed(true)}>
                          <PanelLeftClose data-icon="inline-start" />
                        </Button>
                      </div>
                      <FilePane sessionId={sessionId} />
                    </div>
                  </Panel>
                  <PanelResizeHandle className="w-2 bg-page transition-colors hover:bg-selected-border" />
                </>
              )}
              <Panel defaultSize={72} minSize={36}>
                <Suspense fallback={<PaneLoading />}>
                  <EditorPane sessionId={sessionId} />
                </Suspense>
              </Panel>
            </PanelGroup>
          )}
        </TabsContent>
        <TabsContent className="min-h-0 overflow-hidden" value="system">
          <Suspense fallback={<PaneLoading />}>
            <ControlPane sessionId={sessionId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CompactEditorPane({ sessionId }: { sessionId?: string }) {
  const activeFilePath = useUiStore((state) => state.activeFilePath);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-canvas">
      <div className="flex h-11 items-center justify-between border-b border-hairline bg-panel px-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label="Open files" title="Open files" type="button" variant="outline" size="sm">
              <Files data-icon="inline-start" />
              Files
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[min(92vw,420px)] border-hairline bg-page p-3" side="left">
            <SheetHeader className="p-0 pr-8">
              <SheetTitle className="text-sm text-ink">Files</SheetTitle>
              <SheetDescription className="sr-only">Browse and manage files in the active project.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-hairline bg-canvas">
              <FilePane sessionId={sessionId} showTitle={false} />
            </div>
          </SheetContent>
        </Sheet>
        <span className="truncate pl-3 font-mono text-[11px] text-muted">{activeFilePath ?? "No file selected"}</span>
      </div>
      <Suspense fallback={<PaneLoading />}>
        <EditorPane sessionId={sessionId} />
      </Suspense>
    </div>
  );
}

function PaneLoading() {
  return <div className="flex h-full items-center justify-center text-xs text-muted">Loading panel.</div>;
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
