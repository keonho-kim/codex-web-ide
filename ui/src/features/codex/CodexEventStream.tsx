import { Activity } from "lucide-react";
import { selectCodexEvents, useUiStore } from "../../store/uiStore";

export function CodexEventStream({ running, sessionId }: { running: boolean; sessionId?: string }) {
  const events = useUiStore((state) => selectCodexEvents(state, sessionId));

  return (
    <div className="min-h-0 overflow-hidden rounded-md border border-subtle bg-panel p-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Activity size={14} />
        <span>{running ? "Codex running" : "Codex events"}</span>
      </div>
      <div className="mt-1 flex min-w-0 gap-1 overflow-x-auto">
        {events.length ? (
          events.map((event) => (
            <span className="inline-flex h-7 max-w-[220px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-subtle bg-panel px-2 text-xs text-muted" title={event.detail || event.label} key={event.id}>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{event.label}</span>
              {event.detail ? <span className="overflow-hidden text-ellipsis whitespace-nowrap text-ink">{event.detail}</span> : null}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted">{running ? "Waiting for Codex events." : "No Codex events yet."}</span>
        )}
      </div>
    </div>
  );
}
