import { useEffect } from "react";
import type { useQueryClient } from "@tanstack/react-query";

export function useSessionEvents(activeSessionId: string | undefined, queryClient: ReturnType<typeof useQueryClient>) {
  useEffect(() => {
    if (!activeSessionId) return;
    const source = new EventSource(`/api/sessions/${activeSessionId}/events`);
    source.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["jobs", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["previews", activeSessionId] });
    };
    source.addEventListener("codex.event", () => {
      void queryClient.invalidateQueries({ queryKey: ["codex", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
    });
    source.addEventListener("job.finished", () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
    });
    source.addEventListener("git.state.updated", () => {
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
    });
    for (const eventName of ["job.started", "job.stdout", "job.stderr"]) {
      source.addEventListener(eventName, () => {
        void queryClient.invalidateQueries({ queryKey: ["jobs", activeSessionId] });
      });
    }
    for (const eventName of ["preview.started", "preview.stdout", "preview.stderr", "preview.health.updated", "preview.stopped"]) {
      source.addEventListener(eventName, () => {
        void queryClient.invalidateQueries({ queryKey: ["previews", activeSessionId] });
      });
    }
    for (const eventName of ["service.started", "service.stdout", "service.stderr", "service.health.updated", "service.stopped"]) {
      source.addEventListener(eventName, () => {
        void queryClient.invalidateQueries({ queryKey: ["services", activeSessionId] });
      });
    }
    source.addEventListener("file.changed", () => {
      void queryClient.invalidateQueries({ queryKey: ["tree", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["file", activeSessionId] });
    });
    return () => source.close();
  }, [activeSessionId, queryClient]);
}
