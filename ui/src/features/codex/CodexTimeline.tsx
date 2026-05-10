import { useMemo, useState } from "react";
import { Activity, Bot, ChevronRight, UserRound } from "lucide-react";
import { cn } from "../../lib/classes";
import type { CodexMessage } from "../../lib/types";
import { selectCodexEvents, type CodexEventSummary, useUiStore } from "../../store/uiStore";
import { CommandSuggestion } from "./CommandSuggestion";

type TimelineEntry =
  | { kind: "message"; id: string; timestamp: number; message: CodexMessage }
  | { kind: "event"; id: string; timestamp: number; event: CodexEventSummary };

export function CodexTimeline({ messages, running, sessionId }: { messages: CodexMessage[]; running: boolean; sessionId?: string }) {
  const events = useUiStore((state) => selectCodexEvents(state, sessionId));
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const entries = useMemo<TimelineEntry[]>(
    () => {
      const messageIds = new Set(messages.map((message) => message.id));
      return [
        ...messages.map((message) => ({ kind: "message" as const, id: `message-${message.id}`, timestamp: message.createdAt, message })),
        ...events.filter((event) => !event.messageId || !messageIds.has(event.messageId)).map((event) => ({ kind: "event" as const, id: `event-${event.id}`, timestamp: event.timestamp, event })),
      ].sort((left, right) => left.timestamp - right.timestamp);
    },
    [events, messages],
  );

  const toggleEvent = (id: string) => {
    setExpandedEventIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (entries.length === 0) {
    return <div className="flex h-full items-center justify-center rounded-md border border-subtle bg-panel/60 text-center text-xs text-muted">Start a Codex run from the composer.</div>;
  }

  return (
    <div className="min-h-0 overflow-auto rounded-md border border-subtle bg-panel/60 p-3" data-testid="codex-timeline">
      <div className="space-y-2">
        {entries.map((entry) =>
          entry.kind === "message" ? (
            <MessageEntry key={entry.id} message={entry.message} sessionId={sessionId} />
          ) : (
            <EventEntry expanded={expandedEventIds.has(entry.event.id)} event={entry.event} key={entry.id} onToggle={() => toggleEvent(entry.event.id)} />
          ),
        )}
        {running ? (
          <div className="flex items-center gap-2 rounded-md border border-codex-soft bg-codex-soft px-3 py-2 text-xs text-codex">
            <Activity size={14} />
            <span>Codex is running.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageEntry({ message, sessionId }: { message: CodexMessage; sessionId?: string }) {
  const isAssistant = message.role === "assistant";
  const Icon = isAssistant ? Bot : UserRound;

  return (
    <article className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-md border border-hairline bg-canvas px-3 py-3">
      <span className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-subtle bg-panel text-muted", isAssistant && "text-primary")}>
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <strong className="text-xs text-primary capitalize">{message.role}</strong>
          <time className="shrink-0 text-[10px] text-muted">{formatTime(message.createdAt)}</time>
        </div>
        <p className="m-0 text-[13px] leading-[1.55] whitespace-pre-wrap">{message.text}</p>
        {isAssistant ? <CommandSuggestion sessionId={sessionId} text={message.text} /> : null}
      </div>
    </article>
  );
}

function EventEntry({ event, expanded, onToggle }: { event: CodexEventSummary; expanded: boolean; onToggle(): void }) {
  return (
    <div className="rounded-md border border-hairline bg-panel/80" data-testid="codex-timeline-event">
      <button className="grid min-h-9 w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 px-3 text-left text-xs text-muted" type="button" onClick={onToggle}>
        <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} size={14} />
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="text-codex">{event.label}</span>
          {event.detail ? <span className="ml-2 text-ink">{event.detail}</span> : null}
        </span>
        <time className="text-[10px]">{formatTime(event.timestamp)}</time>
      </button>
      {expanded ? <pre className="m-0 border-t border-hairline px-3 py-2 text-[11px] leading-[1.45] whitespace-pre-wrap text-ink">{event.detail || "No event details."}</pre> : null}
    </div>
  );
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
