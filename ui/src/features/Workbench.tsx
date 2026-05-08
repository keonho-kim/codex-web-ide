import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CodexPane } from "./codex/CodexPane";
import { EditorPane } from "./editor/EditorPane";
import { FilePane } from "./files/FilePane";

export function Workbench({ sessionId }: { sessionId?: string }) {
  return (
    <PanelGroup className="min-h-0" direction="horizontal">
      <Panel defaultSize={18} minSize={14}>
        <FilePane sessionId={sessionId} />
      </Panel>
      <PanelResizeHandle className="w-px bg-[#e0e0e0] transition-colors hover:bg-[#0066cc]" />
      <Panel defaultSize={52} minSize={28}>
        <EditorPane sessionId={sessionId} />
      </Panel>
      <PanelResizeHandle className="w-px bg-[#e0e0e0] transition-colors hover:bg-[#0066cc]" />
      <Panel defaultSize={30} minSize={22}>
        <CodexPane sessionId={sessionId} />
      </Panel>
    </PanelGroup>
  );
}
