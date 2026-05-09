import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CodexPane } from "./codex/CodexPane";
import { EditorPane } from "./editor/EditorPane";
import { FilePane } from "./files/FilePane";
import { DEFAULT_WORKBENCH_LAYOUT, useUiStore } from "../store/uiStore";

export function Workbench({ sessionId }: { sessionId?: string }) {
  const workbenchLayout = normalizeWorkbenchLayout(useUiStore((state) => state.workbenchLayout));
  const setWorkbenchLayout = useUiStore((state) => state.setWorkbenchLayout);

  return (
    <PanelGroup className="min-h-0" direction="horizontal" onLayout={setWorkbenchLayout}>
      <Panel defaultSize={workbenchLayout[0] ?? 18} minSize={14}>
        <FilePane sessionId={sessionId} />
      </Panel>
      <PanelResizeHandle className="w-px bg-hairline transition-colors hover:bg-primary" />
      <Panel defaultSize={workbenchLayout[1] ?? 52} minSize={28}>
        <EditorPane sessionId={sessionId} />
      </Panel>
      <PanelResizeHandle className="w-px bg-hairline transition-colors hover:bg-primary" />
      <Panel defaultSize={workbenchLayout[2] ?? 30} minSize={22}>
        <CodexPane sessionId={sessionId} />
      </Panel>
    </PanelGroup>
  );
}

function normalizeWorkbenchLayout(layout: number[]) {
  if (layout.length !== DEFAULT_WORKBENCH_LAYOUT.length || layout.some((value) => !Number.isFinite(value) || value <= 0)) {
    return DEFAULT_WORKBENCH_LAYOUT;
  }
  return layout;
}
