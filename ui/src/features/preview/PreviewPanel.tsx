import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Play, RefreshCw, RotateCw, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { api, splitCommand } from "../../lib/api";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import type { PreviewInstance } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";

export function PreviewPanel({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("bun run dev");
  const selectedPreviewId = useUiStore((state) => state.selectedPreviewId);
  const setSelectedPreviewId = useUiStore((state) => state.setSelectedPreviewId);
  const [iframeVersion, setIframeVersion] = useState(0);
  const previews = useQuery({
    queryKey: ["previews", sessionId],
    queryFn: () => api<PreviewInstance[]>(`/api/sessions/${sessionId}/previews`),
    enabled: Boolean(sessionId),
  });
  const startPreview = useMutation({
    mutationFn: (commandArgs: string[]) =>
      api<PreviewInstance>(`/api/sessions/${sessionId}/previews`, {
        method: "POST",
        body: { command: commandArgs, approvedDangerous: requiresDangerousApproval(commandArgs) },
      }),
    onSuccess: async (preview) => {
      setSelectedPreviewId(preview.id);
      await queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    },
  });
  const stopPreview = useMutation({
    mutationFn: (id: string) => api(`/api/sessions/${sessionId}/previews/${id}/stop`, { method: "POST" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["previews", sessionId] }),
  });
  const restartPreview = useMutation({
    mutationFn: (id: string) => api(`/api/sessions/${sessionId}/previews/${id}/restart`, { method: "POST" }),
    onSuccess: async (preview: unknown) => {
      if (preview && typeof preview === "object" && "id" in preview) setSelectedPreviewId(String(preview.id));
      await queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    },
  });
  const runningPreviews = previews.data?.filter((preview) => preview.status === "running") ?? [];
  const activePreview = (previews.data ?? []).find((preview) => preview.id === selectedPreviewId) ?? runningPreviews[0];
  const activeLogs = useMemo(() => (activePreview ? [...activePreview.stdout, ...activePreview.stderr].join("") : ""), [activePreview]);
  return (
    <div className="grid h-[calc(100%-38px)] grid-rows-[auto_auto_minmax(0,1fr)_80px] gap-2.5 overflow-auto p-2.5">
      <div className="flex items-center gap-2">
        <input
          className="w-[min(520px,100%)] min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!sessionId || startPreview.isPending || splitCommand(command).length === 0}
          onClick={() => {
            const commandArgs = splitCommand(command);
            if (confirmDangerousCommand(commandArgs)) startPreview.mutate(commandArgs);
          }}
        >
          <Play size={15} />
        </button>
        {runningPreviews.length > 1 ? (
          <select
            className="min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
            value={activePreview?.id ?? ""}
            onChange={(event) => setSelectedPreviewId(event.target.value)}
          >
            {runningPreviews.map((preview) => (
              <option key={preview.id} value={preview.id}>
                {preview.command.join(" ")}
              </option>
            ))}
          </select>
        ) : null}
        {activePreview ? (
          <>
            <button
              className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="Reload iframe"
              type="button"
              onClick={() => setIframeVersion((value) => value + 1)}
            >
              <RotateCw size={15} />
            </button>
            <button
              className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="Restart preview"
              type="button"
              onClick={() => restartPreview.mutate(activePreview.id)}
            >
              <RefreshCw size={15} />
            </button>
            <button
              className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="Stop preview"
              type="button"
              onClick={() => stopPreview.mutate(activePreview.id)}
            >
              <Square size={15} />
            </button>
            <a
              className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
              href={activePreview.publicUrl}
              target="_blank"
              rel="noreferrer"
              title="Open preview"
            >
              <ExternalLink size={15} />
            </a>
          </>
        ) : null}
      </div>
      {activePreview ? (
        <p className="text-xs text-muted">
          {activePreview.status} · port {activePreview.port} · pid {activePreview.pid || "-"} · {activePreview.command.join(" ")}
        </p>
      ) : null}
      {activePreview ? (
        <iframe key={`${activePreview.id}:${iframeVersion}`} className="h-full w-full rounded-md border border-control" title="Preview" src={activePreview.publicUrl} />
      ) : (
        <p className="text-xs text-muted">No preview selected.</p>
      )}
      <pre className="h-[150px] overflow-auto rounded-md bg-ink p-2.5 text-xs whitespace-pre-wrap text-white">
        {activePreview ? activeLogs || activePreview.status : "No preview logs yet."}
      </pre>
    </div>
  );
}
