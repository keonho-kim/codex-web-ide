import { lazy, Suspense, useEffect, useState } from "react";
import { Files, PanelLeftClose, PanelLeftOpen, PanelTopClose, PanelTopOpen } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { normalizeWorkbenchTab, useUiStore, type WorkbenchTab } from "@/store/uiStore";
import { workbenchTabs } from "@/features/workbenchTabs";
import { CodexPane } from "@/features/codex/CodexPane";
import { CodexUsagePane } from "@/features/codex/CodexUsagePane";
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
  const stacked = useMediaQuery("(max-width: 700px)");

  return (
    <section className="h-full min-h-0 overflow-hidden rounded-lg border border-hairline bg-canvas" data-testid="workbench">
      <Tabs className="grid h-full min-h-0 grid-rows-[52px_minmax(0,1fr)] gap-0 max-[700px]:grid-rows-[minmax(0,1fr)]" value={workbenchTab} onValueChange={(value) => setWorkbenchTab(value as WorkbenchTab)}>
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-hairline bg-panel px-4 py-2 max-[700px]:hidden">
          <TabsList className="h-9 bg-canvas max-[700px]:grid max-[700px]:h-auto max-[700px]:w-full max-[700px]:grid-cols-2" variant="default">
            {workbenchTabs.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger className="min-w-24 gap-2 px-3 max-[700px]:min-w-0" key={item.id} value={item.id}>
                  <Icon data-icon="inline-start" />
                  {item.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <span className="truncate text-xs text-muted max-[700px]:hidden">{sessionId ? "One project view at a time" : "Select a project to begin"}</span>
        </div>
        <TabsContent className="min-h-0 overflow-hidden" value="chat">
          <CodexPane activeProjectId={activeProjectId} onSessionCreated={onSessionCreated} sessionId={sessionId} />
        </TabsContent>
        <TabsContent className="min-h-0 overflow-hidden" value="editor">
          {stacked ? (
            <StackedEditorPane editorFilesCollapsed={editorFilesCollapsed} sessionId={sessionId} setEditorFilesCollapsed={setEditorFilesCollapsed} />
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
        <TabsContent className="min-h-0 overflow-hidden" value="control">
          <Suspense fallback={<PaneLoading />}>
            <ControlPane sessionId={sessionId} />
          </Suspense>
        </TabsContent>
        <TabsContent className="min-h-0 overflow-hidden" value="usage">
          <CodexUsagePane sessionId={sessionId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function StackedEditorPane({
  editorFilesCollapsed,
  sessionId,
  setEditorFilesCollapsed,
}: {
  editorFilesCollapsed: boolean;
  sessionId?: string;
  setEditorFilesCollapsed(collapsed: boolean): void;
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-canvas">
      {editorFilesCollapsed ? (
        <div className="flex items-center gap-2 border-b border-hairline bg-panel p-2">
          <Button aria-label="Show files" title="Show files" type="button" variant="ghost" size="icon-sm" onClick={() => setEditorFilesCollapsed(false)}>
            <PanelTopOpen data-icon="inline-start" />
          </Button>
          <Files size={16} className="text-muted" />
        </div>
      ) : (
        <div className="grid min-h-0 max-h-[34vh] grid-rows-[44px_minmax(0,1fr)] border-b border-hairline">
          <div className="flex h-11 items-center justify-end bg-panel px-2">
            <Button aria-label="Hide files" title="Hide files" type="button" variant="ghost" size="icon-sm" onClick={() => setEditorFilesCollapsed(true)}>
              <PanelTopClose data-icon="inline-start" />
            </Button>
          </div>
          <FilePane sessionId={sessionId} />
        </div>
      )}
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
