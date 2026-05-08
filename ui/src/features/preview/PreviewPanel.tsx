import { PreviewFrame } from "./PreviewFrame";
import { PreviewToolbar } from "./PreviewToolbar";
import { usePreviewPanel } from "./usePreviewPanel";

export function PreviewPanel({ sessionId }: { sessionId?: string }) {
  const preview = usePreviewPanel(sessionId);

  return (
    <div className="grid h-[calc(100%-38px)] grid-rows-[auto_auto_minmax(0,1fr)_80px] gap-2.5 overflow-auto p-2.5">
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
      {preview.actions.error ? <p className="m-0 text-xs text-destructive">{preview.actions.error}</p> : null}
      {preview.activePreview ? (
        <p className="text-xs text-muted">
          {preview.activePreview.status} · port {preview.activePreview.port} · pid {preview.activePreview.pid || "-"} · {preview.activePreview.command.join(" ")}
        </p>
      ) : null}
      <PreviewFrame iframeVersion={preview.iframeVersion} preview={preview.activePreview} />
      <pre className="h-[150px] overflow-auto rounded-md bg-ink p-2.5 text-xs whitespace-pre-wrap text-white">
        {preview.activePreview ? preview.activeLogs || preview.activePreview.status : "No preview logs yet."}
      </pre>
    </div>
  );
}
