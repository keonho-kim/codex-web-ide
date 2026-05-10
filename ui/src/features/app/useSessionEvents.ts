import { useEffect } from "react";
import type { useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "../../store/uiStore";

export function useSessionEvents(activeSessionId: string | undefined, queryClient: ReturnType<typeof useQueryClient>) {
  const appendCodexEvent = useUiStore((state) => state.appendCodexEvent);

  useEffect(() => {
    if (!activeSessionId) return;
    const source = new EventSource(`/api/sessions/${activeSessionId}/events`);
    source.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["jobs", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["previews", activeSessionId] });
    };
    source.addEventListener("codex.event", (event) => {
      appendCodexEvent(activeSessionId, summarizeCodexEvent(event));
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
  }, [activeSessionId, appendCodexEvent, queryClient]);
}

function summarizeCodexEvent(event: MessageEvent) {
  const fallback = { id: crypto.randomUUID(), label: event.type, timestamp: Date.now() };
  try {
    const envelope = JSON.parse(event.data) as { id?: string; timestamp?: number; payload?: unknown };
    const payload = envelope.payload;
    if (!payload || typeof payload !== "object") return fallback;
    const record = payload as Record<string, unknown>;
    const message = messagePayload(record.message);
    return {
      id: envelope.id || fallback.id,
      label: typeof message?.role === "string" ? `codex.${message.role}` : typeof record.type === "string" ? record.type : event.type,
      detail: message?.text || eventDetail(record),
      messageId: message?.id,
      timestamp: typeof envelope.timestamp === "number" ? envelope.timestamp : Date.now(),
    };
  } catch {
    return fallback;
  }
}

function eventDetail(record: Record<string, unknown>) {
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "object" && record.error && "message" in record.error) {
    const message = (record.error as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  if (typeof record.item === "object" && record.item && "type" in record.item) {
    const type = (record.item as { type?: unknown }).type;
    return typeof type === "string" ? type : undefined;
  }
  return undefined;
}

function messagePayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.text === "string" ? { id: typeof record.id === "string" ? record.id : undefined, role: record.role, text: record.text } : null;
}
