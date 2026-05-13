import { useEffect } from "react";
import type { useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/store/uiStore";
import type { Envelope } from "@/lib/types";
import { summarizeCodexEvent } from "@/features/codex/codexEventSummary";

const INVALIDATION_FLUSH_MS = 250;

type QueryInvalidator = {
  invalidateQueries(input: { queryKey: readonly unknown[] }): Promise<unknown>;
};

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
  const invalidate = createBatchedInvalidator(queryClient);
  const source = new EventSource(`/api/sessions/events?ids=${encodeURIComponent(sessionIds.join(","))}`);
  source.onmessage = () => {
    invalidate(["sessions"]);
    for (const sessionId of sessionIds) {
      invalidate(["git", sessionId]);
      invalidate(["jobs", sessionId]);
      invalidate(["previews", sessionId]);
    }
  };
  source.addEventListener("codex.event", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    const summary = summarizeCodexEvent(event);
    appendCodexEvent(sessionId, summary);
    if (summary.label === "turn.failed" || summary.label === "codex.assistant" || summary.label === "codex.system") {
      invalidate(["codex", sessionId, "resume"]);
      invalidate(["sessions"]);
    }
  });
  source.addEventListener("job.finished", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    invalidate(["jobs", sessionId]);
    invalidate(["git", sessionId]);
  });
  source.addEventListener("git.state.updated", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    invalidate(["sessions"]);
    invalidate(["codex", sessionId, "resume"]);
    invalidate(["codex", sessionId, "status"]);
    invalidate(["git", sessionId]);
  });
  for (const eventName of ["job.started", "job.stdout", "job.stderr"]) {
    source.addEventListener(eventName, (event) => {
      const sessionId = sessionIdFromEvent(event);
      if (!sessionId) return;
      invalidate(["jobs", sessionId]);
    });
  }
  for (const eventName of ["preview.started", "preview.stdout", "preview.stderr", "preview.health.updated", "preview.stopped"]) {
    source.addEventListener(eventName, (event) => {
      const sessionId = sessionIdFromEvent(event);
      if (!sessionId) return;
      invalidate(["previews", sessionId]);
    });
  }
  for (const eventName of ["service.started", "service.stdout", "service.stderr", "service.health.updated", "service.stopped"]) {
    source.addEventListener(eventName, (event) => {
      const sessionId = sessionIdFromEvent(event);
      if (!sessionId) return;
      invalidate(["services", sessionId]);
    });
  }
  source.addEventListener("file.changed", (event) => {
    const sessionId = sessionIdFromEvent(event);
    if (!sessionId) return;
    invalidate(["tree", sessionId]);
    invalidate(["file", sessionId]);
  });
  return {
    close: () => {
      source.close();
      invalidate.flush();
    },
  };
}

export function createBatchedInvalidator(queryClient: QueryInvalidator) {
  const pending = new Map<string, readonly unknown[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const keys = [...pending.values()];
    pending.clear();
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };

  const schedule = (queryKey: readonly unknown[]) => {
    pending.set(JSON.stringify(queryKey), queryKey);
    if (timer) return;
    timer = setTimeout(flush, INVALIDATION_FLUSH_MS);
  };
  schedule.flush = flush;
  return schedule;
}

function sessionIdFromEvent(event: Event) {
  try {
    const envelope = JSON.parse((event as MessageEvent).data) as Partial<Envelope>;
    return typeof envelope.sessionId === "string" ? envelope.sessionId : undefined;
  } catch {
    return undefined;
  }
}
