import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FilePenLine,
  Globe,
  Loader2,
  TerminalSquare,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/classes";
import type { CodexMessage } from "@/lib/types";
import { selectCodexEvents, type CodexEventSummary, useUiStore } from "@/store/uiStore";
import { CommandSuggestion } from "@/features/codex/CommandSuggestion";
import { buildCodexTimelineEntries, codexTimelineScrollKey } from "@/features/codex/codexTimelineEntries";

const MarkdownContent = lazy(() => import("@/shared/markdown/MarkdownContent").then((module) => ({ default: module.MarkdownContent })));

export function CodexTimeline({ messages, running, sessionId }: { messages: CodexMessage[]; running: boolean; sessionId?: string }) {
  const events = useUiStore((state) => selectCodexEvents(state, sessionId));
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [collapsedEventIds, setCollapsedEventIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const entries = useMemo(() => buildCodexTimelineEntries(messages, events), [events, messages]);
  const scrollKey = useMemo(() => codexTimelineScrollKey(entries, running), [entries, running]);
  const latestEventId = useMemo(() => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.kind === "event") return entry.event.id;
    }
    return undefined;
  }, [entries]);

  const toggleEvent = (id: string, expanded: boolean) => {
    setExpandedEventIds((current) => {
      const next = new Set(current);
      if (expanded) next.delete(id);
      else next.add(id);
      return next;
    });
    setCollapsedEventIds((current) => {
      const next = new Set(current);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
        return;
      }
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollKey]);

  if (entries.length === 0) {
    return <div className="flex h-full items-center justify-center rounded-md border border-subtle bg-panel/60 text-center text-xs text-muted">Start a Codex run from the composer.</div>;
  }

  return (
    <div className="min-h-0 overflow-auto rounded-md border border-subtle bg-panel/60 p-3" data-testid="codex-timeline" ref={scrollRef}>
      <div className="flex flex-col gap-2">
        {entries.map((entry) => {
          if (entry.kind === "message") return <MessageEntry key={entry.id} message={entry.message} sessionId={sessionId} transient={entry.transient} />;
          const expanded = expandedEventIds.has(entry.event.id) || (entry.event.id === latestEventId && !collapsedEventIds.has(entry.event.id));
          return <EventEntry expanded={expanded} event={entry.event} key={entry.id} onToggle={() => toggleEvent(entry.event.id, expanded)} />;
        })}
        {running ? (
          <div className="flex items-center gap-2 rounded-md border border-codex-soft bg-codex-soft px-3 py-2 text-xs text-codex">
            <Loader2 className="animate-spin motion-reduce:animate-none" size={14} />
            <span>Codex is running.</span>
          </div>
        ) : null}
        <div aria-hidden="true" ref={scrollAnchorRef} />
      </div>
    </div>
  );
}

function MessageEntry({ message, sessionId, transient = false }: { message: CodexMessage; sessionId?: string; transient?: boolean }) {
  const isAssistant = message.role === "assistant";
  const Icon = isAssistant ? Bot : UserRound;
  const text = message.text || (transient ? "Assistant response is streaming." : "");

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
        <Suspense fallback={<p className="m-0 text-[13px] leading-[1.55] whitespace-pre-wrap">{text}</p>}>
          <MarkdownContent className="text-[13px] leading-[1.55] [&>p:first-child]:mt-0 [&>p:last-child]:mb-0" content={text} />
        </Suspense>
        {isAssistant ? <CommandSuggestion sessionId={sessionId} text={text} /> : null}
      </div>
    </article>
  );
}

function EventEntry({ event, expanded, onToggle }: { event: CodexEventSummary; expanded: boolean; onToggle(): void }) {
  const Icon = eventStatusIcon(event);
  const body = event.body || event.detail || event.preview || "No event details.";
  return (
    <div className="rounded-md border border-hairline bg-panel/80" data-testid="codex-timeline-event">
      <button className="grid min-h-11 w-full grid-cols-[18px_22px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left text-xs text-muted" type="button" onClick={onToggle}>
        <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} size={14} />
        <span className="flex size-5 items-center justify-center rounded border border-subtle bg-canvas text-codex">
          <Icon className={cn(event.status === "in_progress" && "animate-spin motion-reduce:animate-none")} size={13} />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-ink">{event.title || event.label}</span>
            <StatusLabel status={event.status} />
          </span>
          {event.preview ? <span className="mt-0.5 block truncate text-[11px] text-muted">{event.preview}</span> : null}
        </span>
        <time className="shrink-0 text-[10px]">{formatTime(event.timestamp)}</time>
      </button>
      {expanded ? <pre className="m-0 max-h-72 overflow-auto border-t border-hairline px-3 py-2 text-[11px] leading-[1.45] whitespace-pre-wrap text-ink">{body}</pre> : null}
    </div>
  );
}

function StatusLabel({ status }: { status?: string }) {
  if (!status) return null;
  const Icon = statusIcon(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px]",
        status === "failed"
          ? "border-destructive/30 bg-canvas text-destructive"
          : status === "completed"
            ? "border-success-soft bg-success-soft text-success"
            : "border-warning-soft bg-warning-soft text-warning",
      )}
    >
      <Icon className={cn(status === "in_progress" && "animate-spin motion-reduce:animate-none")} size={10} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function eventStatusIcon(event: CodexEventSummary): LucideIcon {
  if (event.status === "in_progress") return Loader2;
  if (event.status === "completed") return CheckCircle2;
  if (event.status === "failed") return CircleAlert;
  return eventIcon(event.kind);
}

function eventIcon(kind: CodexEventSummary["kind"]): LucideIcon {
  if (kind === "command") return TerminalSquare;
  if (kind === "tool") return Wrench;
  if (kind === "file") return FilePenLine;
  if (kind === "reasoning") return Brain;
  if (kind === "search") return Globe;
  if (kind === "todo") return ClipboardList;
  if (kind === "error") return CircleAlert;
  if (kind === "turn") return Activity;
  return Activity;
}

function statusIcon(status: string): LucideIcon {
  if (status === "completed") return CheckCircle2;
  if (status === "failed") return CircleAlert;
  return Loader2;
}
