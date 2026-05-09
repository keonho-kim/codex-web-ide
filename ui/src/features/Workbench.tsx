import { useEffect, useState } from "react";
import { Code2, Files, MessageSquare, PanelTopClose, PanelTopOpen } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/classes";
import { CodexPane } from "./codex/CodexPane";
import { EditorPane } from "./editor/EditorPane";
import { FilePane } from "./files/FilePane";
import { DEFAULT_WORKBENCH_LAYOUT, normalizeCollapsedMainPanels, type MainPanelKey, useUiStore } from "../store/uiStore";

export function Workbench({ sessionId }: { sessionId?: string }) {
  const workbenchLayout = normalizeWorkbenchLayout(useUiStore((state) => state.workbenchLayout));
  const collapsed = normalizeCollapsedMainPanels(useUiStore((state) => state.collapsedMainPanels));
  const togglePanel = useUiStore((state) => state.toggleMainPanel);
  const setWorkbenchLayout = useUiStore((state) => state.setWorkbenchLayout);
  const compact = useMediaQuery("(max-width: 900px)");

  if (compact) {
    return (
      <section className="grid min-h-0 grid-rows-[34px_minmax(0,1fr)] overflow-hidden bg-page min-[701px]:p-2">
        <PanelToggleBar collapsed={collapsed} onToggle={togglePanel} />
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(150px,34%)_minmax(110px,22%)] gap-2 overflow-hidden max-[700px]:grid-rows-[minmax(0,1fr)_minmax(150px,38%)] max-[700px]:gap-0">
          {!collapsed.codex ? (
            <div className="min-h-0 overflow-hidden rounded-lg border border-hairline bg-canvas max-[700px]:rounded-none max-[700px]:border-x-0">
              <CodexPane sessionId={sessionId} />
            </div>
          ) : null}
          {!collapsed.editor ? (
            <div className="min-h-[150px] overflow-hidden rounded-lg border border-hairline bg-canvas max-[700px]:rounded-none max-[700px]:border-x-0">
              <EditorPane sessionId={sessionId} />
            </div>
          ) : null}
          {!collapsed.files ? (
            <div className="min-h-[110px] overflow-hidden rounded-lg border border-hairline bg-canvas max-[700px]:hidden">
              <FilePane sessionId={sessionId} />
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-0 grid-rows-[34px_minmax(0,1fr)] overflow-hidden bg-canvas">
      <PanelToggleBar collapsed={collapsed} onToggle={togglePanel} />
      <PanelGroup className="min-h-0 bg-canvas" direction="horizontal" onLayout={setWorkbenchLayout}>
        {!collapsed.files ? (
          <>
            <Panel defaultSize={workbenchLayout[0] ?? 18} minSize={14}>
              <FilePane sessionId={sessionId} />
            </Panel>
            {(!collapsed.editor || !collapsed.codex) ? <PanelResizeHandle className="w-1 bg-page transition-colors hover:bg-primary" /> : null}
          </>
        ) : null}
        {!collapsed.editor ? (
          <>
            <Panel defaultSize={workbenchLayout[1] ?? 52} minSize={28}>
              <EditorPane sessionId={sessionId} />
            </Panel>
            {!collapsed.codex ? <PanelResizeHandle className="w-1 bg-page transition-colors hover:bg-primary" /> : null}
          </>
        ) : null}
        {!collapsed.codex ? (
          <Panel defaultSize={workbenchLayout[2] ?? 30} minSize={22}>
            <CodexPane sessionId={sessionId} />
          </Panel>
        ) : null}
      </PanelGroup>
    </section>
  );
}

function PanelToggleBar({ collapsed, onToggle }: { collapsed: Record<MainPanelKey, boolean>; onToggle(panel: MainPanelKey): void }) {
  const items: Array<{ id: MainPanelKey; label: string; icon: typeof Files }> = [
    { id: "files", label: "Files", icon: Files },
    { id: "editor", label: "Editor", icon: Code2 },
    { id: "codex", label: "Chat", icon: MessageSquare },
  ];

  return (
    <div className="flex min-w-0 items-center justify-between border-b border-hairline bg-panel px-2">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isCollapsed = collapsed[item.id];
          return (
            <Button
              className={cn("h-7 gap-1.5 px-2 text-xs", !isCollapsed && "border-selected-border bg-selected text-primary")}
              key={item.id}
              type="button"
              variant="outline"
              size="xs"
              title={`${isCollapsed ? "Show" : "Hide"} ${item.label}`}
              onClick={() => onToggle(item.id)}
            >
              <Icon data-icon="inline-start" />
              {item.label}
              {isCollapsed ? <PanelTopOpen size={12} /> : <PanelTopClose size={12} />}
            </Button>
          );
        })}
      </div>
      <span className="shrink-0 text-[11px] text-muted max-[700px]:hidden">Chat stays primary on small screens</span>
    </div>
  );
}

function normalizeWorkbenchLayout(layout: number[]) {
  if (layout.length !== DEFAULT_WORKBENCH_LAYOUT.length || layout.some((value) => !Number.isFinite(value) || value <= 0)) {
    return DEFAULT_WORKBENCH_LAYOUT;
  }
  return layout;
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
