import { useEffect } from "react";
import type { useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "../../store/uiStore";
import type { Envelope } from "../../lib/types";
import { summarizeCodexEvent } from "../codex/codexEventSummary";

export function useSessionEvents(sessionIds: string[] | string | undefined, queryClient: ReturnType<typeof useQueryClient>) {
  const appendCodexEvent = useUiStore((state) => state.appendCodexEvent);
  const ids = Array.isArray(sessionIds) ? sessionIds : sessionIds ? [sessionIds] : [];
  const key = ids.join(":");

  useEffect(() => {
    const activeIds = key ? key.split(":").filter(Boolean) : [];
    if (activeIds.length === 0) return;
    const source = subscribeSessionEvents(activeIds, appendCodexEvent, queryClient);
    return () => source.close();
  }, [appendCodexEvent, key, queryClient]);
}

function subscribeSessionEvents(sessionIds: string[], appendCodexEvent: ReturnType<typeof useUiStore.getState>["appendCodexEvent"], queryClient: ReturnType<typeof useQueryClient>) {
  const source = new EventSource(`/api/sessions/events?ids=${encodeURIComponent(sessionIds.join(","))}`);
  source.onmessage = () => {
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    for (const sessionId of sessionIds) {
      void queryClient.invalidateQueries({ queryKey: ["git", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    }
  };
  source.addEventListener("codex.event", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    appendCodexEvent(sessionId, summarizeCodexEvent(event));
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["codex", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["git", sessionId] });
  });
  source.addEventListener("job.finished", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    void queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["git", sessionId] });
  });
  source.addEventListener("git.state.updated", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["git", sessionId] });
  });
  for (const eventName of ["job.started", "job.stdout", "job.stderr"]) {
    source.addEventListener(eventName, (event) => {
      const sessionId = sessionIdFromEvent(event);
      if (!sessionId) return;
      void queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] });
    });
  }
  for (const eventName of ["preview.started", "preview.stdout", "preview.stderr", "preview.health.updated", "preview.stopped"]) {
    source.addEventListener(eventName, (event) => {
      const sessionId = sessionIdFromEvent(event);
      if (!sessionId) return;
      void queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    });
  }
  for (const eventName of ["service.started", "service.stdout", "service.stderr", "service.health.updated", "service.stopped"]) {
    source.addEventListener(eventName, (event) => {
      const sessionId = sessionIdFromEvent(event);
      if (!sessionId) return;
      void queryClient.invalidateQueries({ queryKey: ["services", sessionId] });
    });
  }
  source.addEventListener("file.changed", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    void queryClient.invalidateQueries({ queryKey: ["tree", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["file", sessionId] });
  });
  return source;
}

function sessionIdFromEvent(event: Event) {
  try {
    const envelope = JSON.parse((event as MessageEvent).data) as Partial<Envelope>;
    return typeof envelope.sessionId === "string" ? envelope.sessionId : undefined;
  } catch {
    return undefined;
  }
}
