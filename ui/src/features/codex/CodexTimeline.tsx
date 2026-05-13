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
  const [collapsedActivityIds, setCollapsedActivityIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const entries = useMemo(() => buildCodexTimelineEntries(messages, events), [events, messages]);
  const scrollKey = useMemo(() => codexTimelineScrollKey(entries, running), [entries, running]);

  const toggleActivity = (id: string, collapsed: boolean) => {
    setCollapsedActivityIds((current) => {
      const next = new Set(current);
      if (collapsed) next.delete(id);
      else next.add(id);
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
    return <div className="flex h-full items-center justify-center rounded-md border border-subtle bg-canvas text-center text-xs text-muted">Start a Codex run from the composer.</div>;
  }

  return (
    <div className="min-h-0 overflow-auto rounded-md border border-subtle bg-canvas px-4 py-3" data-testid="codex-timeline" ref={scrollRef}>
      <div className="flex flex-col gap-5">
        {entries.map((entry) => {
          if (entry.kind === "message") return <MessageEntry key={entry.id} message={entry.message} sessionId={sessionId} transient={entry.transient} />;
          const collapsed = collapsedActivityIds.has(entry.id);
          return <ActivityEntry collapsed={collapsed} events={entry.events} key={entry.id} onToggle={() => toggleActivity(entry.id, collapsed)} />;
        })}
        {running ? (
          <div className="flex items-center gap-2 text-xs text-codex">
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
    <article className="grid grid-cols-[24px_minmax(0,1fr)] gap-2">
      <span className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-muted", isAssistant && "text-primary")}>
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <strong className="text-xs text-primary capitalize">{message.role}</strong>
          {transient ? <span className="text-[10px] text-muted">streaming</span> : null}
        </div>
        <Suspense fallback={<p className="m-0 text-sm leading-7 whitespace-pre-wrap">{text}</p>}>
          <MarkdownContent className="text-sm leading-7 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0" content={text} />
        </Suspense>
        {isAssistant ? <CommandSuggestion sessionId={sessionId} text={text} /> : null}
      </div>
    </article>
  );
}

function ActivityEntry({ events, collapsed, onToggle }: { events: CodexEventSummary[]; collapsed: boolean; onToggle(): void }) {
  const Icon = activityIcon(events);
  return (
    <div className="ml-8 text-xs text-muted" data-testid="codex-timeline-activity">
      <button className="inline-flex max-w-full items-center gap-2 text-left text-muted hover:text-ink" type="button" onClick={onToggle}>
        <Icon size={14} />
        <span className="truncate">{activitySummary(events)}</span>
        <ChevronRight className={cn("transition-transform", !collapsed && "rotate-90")} size={13} />
      </button>
      {!collapsed ? (
        <div className="mt-2 grid gap-1.5">
          {events.map((event) => (
            <ActivityLine event={event} key={event.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActivityLine({ event }: { event: CodexEventSummary }) {
  const Icon = eventStatusIcon(event);
  const detail = event.preview || event.detail || event.body;
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
      <Icon className={cn("mt-0.5", event.status === "in_progress" && "animate-spin motion-reduce:animate-none")} size={13} />
      <span className="min-w-0">
        <span className="block truncate">{activityLineTitle(event)}</span>
        {detail ? <span className="mt-0.5 block truncate text-[11px] text-muted/80">{detail}</span> : null}
      </span>
    </div>
  );
}

function activitySummary(events: CodexEventSummary[]) {
  const files = events.filter((event) => event.kind === "file").length;
  const commands = events.filter((event) => event.kind === "command").length;
  const tools = events.filter((event) => event.kind === "tool").length;
  const searches = events.filter((event) => event.kind === "search").length;
  const parts = [
    files ? `${files} file${files === 1 ? "" : "s"}` : "",
    commands ? `${commands} command${commands === 1 ? "" : "s"}` : "",
    tools ? `${tools} tool${tools === 1 ? "" : "s"}` : "",
    searches ? `${searches} search${searches === 1 ? "" : "es"}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(", ")} explored` : `${events.length} Codex activit${events.length === 1 ? "y" : "ies"}`;
}

function activityLineTitle(event: CodexEventSummary) {
  if (event.kind === "command") return `Run ${event.title || event.label}`;
  if (event.kind === "file") return event.title || "Edited files";
  if (event.kind === "tool") return `Used ${event.title || event.label}`;
  if (event.kind === "reasoning") return "Reasoned";
  if (event.kind === "search") return event.title || "Searched";
  if (event.kind === "todo") return event.title || "Updated plan";
  return event.title || event.label;
}

function activityIcon(events: CodexEventSummary[]): LucideIcon {
  if (events.some((event) => event.status === "in_progress")) return Loader2;
  if (events.some((event) => event.kind === "command")) return TerminalSquare;
  if (events.some((event) => event.kind === "tool")) return Wrench;
  if (events.some((event) => event.kind === "file")) return FilePenLine;
  if (events.some((event) => event.kind === "search")) return Globe;
  return Activity;
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
