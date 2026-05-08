import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, splitCommand } from "../../lib/api";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import { getErrorMessage } from "../../lib/errors";
import type { PreviewInstance } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";

export function usePreviewPanel(sessionId?: string) {
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
    onSuccess: async (_result, id) => {
      if (selectedPreviewId === id) setSelectedPreviewId(undefined);
      await queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    },
  });
  const restartPreview = useMutation({
    mutationFn: (id: string) => api(`/api/sessions/${sessionId}/previews/${id}/restart`, { method: "POST" }),
    onSuccess: async (preview: unknown) => {
      if (preview && typeof preview === "object" && "id" in preview) setSelectedPreviewId(String(preview.id));
      await queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    },
  });

  const runningPreviews = previews.data?.filter((preview) => preview.status === "running" || preview.status === "starting") ?? [];
  const activePreview = (previews.data ?? []).find((preview) => preview.id === selectedPreviewId) ?? runningPreviews[0];
  const activeLogs = useMemo(() => (activePreview ? [...activePreview.stdout, ...activePreview.stderr].join("") : ""), [activePreview]);
  const commandArgs = splitCommand(command);

  return {
    activeLogs,
    activePreview,
    command,
    iframeVersion,
    runningPreviews,
    setCommand,
    actions: {
      reload: () => setIframeVersion((value) => value + 1),
      restart: () => {
        if (activePreview) restartPreview.mutate(activePreview.id);
      },
      selectPreview: setSelectedPreviewId,
      start: () => {
        if (confirmDangerousCommand(commandArgs)) startPreview.mutate(commandArgs);
      },
      stop: () => {
        if (activePreview) stopPreview.mutate(activePreview.id);
      },
      error: startPreview.error
        ? getErrorMessage(startPreview.error)
        : stopPreview.error
          ? getErrorMessage(stopPreview.error)
          : restartPreview.error
            ? getErrorMessage(restartPreview.error)
            : null,
      startDisabled: !sessionId || startPreview.isPending || commandArgs.length === 0,
    },
  };
}
