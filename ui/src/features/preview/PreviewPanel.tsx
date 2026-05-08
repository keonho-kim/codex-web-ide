import { PreviewFrame } from "./PreviewFrame";
import { PreviewToolbar } from "./PreviewToolbar";
import { usePreviewPanel } from "./usePreviewPanel";

export function PreviewPanel({ sessionId }: { sessionId?: string }) {
  const preview = usePreviewPanel(sessionId);

  return (
    <div className="panel-grid grid-rows-[auto_auto_minmax(0,1fr)_80px]">
      <PreviewToolbar
        activePreview={preview.activePreview}
        command={preview.command}
        runningPreviews={preview.runningPreviews}
        startDisabled={preview.actions.startDisabled}
        onCommandChange={preview.setCommand}
        onReload={preview.actions.reload}
        onRestart={preview.actions.restart}
        onSelectPreview={preview.actions.selectPreview}
        onStart={preview.actions.start}
        onStop={preview.actions.stop}
      />
      {preview.actions.error ? <p className="error-text m-0">{preview.actions.error}</p> : null}
      {preview.activePreview ? (
        <p className="empty-state">
          {preview.activePreview.status} · port {preview.activePreview.port} · pid {preview.activePreview.pid || "-"} · {preview.activePreview.command.join(" ")}
        </p>
      ) : null}
      <PreviewFrame iframeVersion={preview.iframeVersion} preview={preview.activePreview} />
      <pre className="log-output">
        {preview.activePreview ? preview.activeLogs || preview.activePreview.status : "No preview logs yet."}
      </pre>
    </div>
  );
}
