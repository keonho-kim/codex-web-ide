import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CodexPane } from "./codex/CodexPane";
import { EditorPane } from "./editor/EditorPane";
import { FilePane } from "./files/FilePane";
import { useUiStore } from "../store/uiStore";

export function Workbench({ sessionId }: { sessionId?: string }) {
  const workbenchLayout = useUiStore((state) => state.workbenchLayout);
  const setWorkbenchLayout = useUiStore((state) => state.setWorkbenchLayout);

  return (
    <PanelGroup className="min-h-0" direction="horizontal" onLayout={setWorkbenchLayout}>
      <Panel defaultSize={workbenchLayout[0] ?? 18} minSize={14}>
        <FilePane sessionId={sessionId} />
      </Panel>
      <PanelResizeHandle className="resize-handle" />
      <Panel defaultSize={workbenchLayout[1] ?? 52} minSize={28}>
        <EditorPane sessionId={sessionId} />
      </Panel>
      <PanelResizeHandle className="resize-handle" />
      <Panel defaultSize={workbenchLayout[2] ?? 30} minSize={22}>
        <CodexPane sessionId={sessionId} />
      </Panel>
    </PanelGroup>
  );
}
