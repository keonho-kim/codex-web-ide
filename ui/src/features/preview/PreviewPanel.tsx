import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Play, RefreshCw, RotateCw, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { commandRowClass, iconButtonClass, inputClass, logClass, mutedClass, panelContentClass } from "../../components/uiClasses";
import { api, splitCommand } from "../../lib/api";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import type { PreviewInstance } from "../../lib/types";

export function PreviewPanel({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("bun run dev");
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>();
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
    <div className={`${panelContentClass} grid grid-rows-[auto_auto_minmax(0,1fr)_80px] gap-2.5`}>
      <div className={commandRowClass}>
        <input className={`${inputClass} w-[min(520px,100%)]`} value={command} onChange={(event) => setCommand(event.target.value)} />
        <button
          className={iconButtonClass}
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
          <select className={inputClass} value={activePreview?.id ?? ""} onChange={(event) => setSelectedPreviewId(event.target.value)}>
            {runningPreviews.map((preview) => (
              <option key={preview.id} value={preview.id}>
                {preview.command.join(" ")}
              </option>
            ))}
          </select>
        ) : null}
        {activePreview ? (
          <>
            <button className={iconButtonClass} title="Reload iframe" type="button" onClick={() => setIframeVersion((value) => value + 1)}>
              <RotateCw size={15} />
            </button>
            <button className={iconButtonClass} title="Restart preview" type="button" onClick={() => restartPreview.mutate(activePreview.id)}>
              <RefreshCw size={15} />
            </button>
            <button className={iconButtonClass} title="Stop preview" type="button" onClick={() => stopPreview.mutate(activePreview.id)}>
              <Square size={15} />
            </button>
            <a className={iconButtonClass} href={activePreview.publicUrl} target="_blank" rel="noreferrer" title="Open preview">
              <ExternalLink size={15} />
            </a>
          </>
        ) : null}
      </div>
      {activePreview ? (
        <p className={mutedClass}>
          {activePreview.status} · port {activePreview.port} · pid {activePreview.pid || "-"} · {activePreview.command.join(" ")}
        </p>
      ) : null}
      {activePreview ? (
        <iframe key={`${activePreview.id}:${iframeVersion}`} className="h-full w-full rounded-md border border-control" title="Preview" src={activePreview.publicUrl} />
      ) : (
        <p className={mutedClass}>No preview selected.</p>
      )}
      <pre className={logClass}>{activePreview ? activeLogs || activePreview.status : "No preview logs yet."}</pre>
    </div>
  );
}
