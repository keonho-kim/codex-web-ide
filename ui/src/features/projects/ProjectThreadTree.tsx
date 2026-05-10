import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Circle, CircleAlert, Folder, Loader2, MessageSquare, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import { EMPTY_CODEX_EVENTS, useUiStore } from "../../store/uiStore";
import type { CodexThreadRecord, Project, Session } from "../../lib/types";
import { codexSessionSignal } from "./sessionSignal";

type ThreadListResponse = {
  threads: CodexThreadRecord[];
  activeThreadId: string | null;
};

type ProjectEntry = {
  project: Project;
  sessions: Session[];
};

type SessionEntry = {
  project: Project;
  session: Session;
};

export function ProjectThreadTree({
  activeProjectId,
  activeSessionId,
  onProjectDelete,
  onProjectSelect,
  onSessionDelete,
  onSessionSelect,
  projects,
  sessions,
}: {
  activeProjectId?: string;
  activeSessionId?: string;
  onProjectDelete(id: string): void;
  onProjectSelect(id: string): void;
  onSessionDelete(id: string): void;
  onSessionSelect(id: string): void;
  projects: Project[];
  sessions: Session[];
}) {
  const queryClient = useQueryClient();
  const entries = useMemo(() => projects.map((project) => ({ project, sessions: sessionsForProject(project, sessions) })), [projects, sessions]);
  const sessionEntries = useMemo(() => entries.flatMap((entry) => entry.sessions.map((session) => ({ project: entry.project, session }))), [entries]);
  const codexEvents = useUiStore((state) => state.codexEvents);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeProjectId ? [activeProjectId] : []));

  useEffect(() => {
    if (!activeProjectId) return;
    setExpanded((current) => new Set(current).add(activeProjectId));
  }, [activeProjectId]);

  const threadQueries = useQueries({
    queries: sessionEntries.map((entry) => ({
      queryKey: ["codex", entry.session.id, "threads"],
      queryFn: () => api<ThreadListResponse>(`/api/sessions/${entry.session.id}/codex/threads`),
      enabled: Boolean(entry.session.id),
    })),
  });
  const threadsBySessionId = useMemo(() => new Map(sessionEntries.map((entry, index) => [entry.session.id, threadQueries[index]])), [sessionEntries, threadQueries]);

  const createChatSession = useMutation({
    mutationFn: async (entry: ProjectEntry) => {
      const session = await api<Session>("/api/sessions", { method: "POST", body: { projectId: entry.project.id } });
      const thread = await api<CodexThreadRecord>(`/api/sessions/${session.id}/codex/threads`, { method: "POST", body: {} });
      return { project: entry.project, session, thread };
    },
    onSuccess: async ({ project, session }) => {
      onProjectSelect(project.id);
      onSessionSelect(session.id);
      setExpanded((current) => new Set(current).add(project.id));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["codex", session.id] }),
      ]);
    },
  });

  const selectProject = (entry: ProjectEntry) => {
    onProjectSelect(entry.project.id);
    setExpanded((current) => new Set(current).add(entry.project.id));
  };

  const selectThread = useMutation({
    mutationFn: async ({ entry, threadId }: { entry: SessionEntry; threadId: string }) => {
      const thread = await api<CodexThreadRecord>(`/api/sessions/${entry.session.id}/codex/threads/${threadId}/select`, { method: "POST" });
      return { entry, thread };
    },
    onSuccess: async ({ entry }) => {
      onProjectSelect(entry.project.id);
      onSessionSelect(entry.session.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["codex", entry.session.id] }),
      ]);
    },
  });

  const deleteThread = useMutation({
    mutationFn: async ({ entry, threadId }: { entry: SessionEntry; threadId: string }) => {
      return api<ThreadListResponse>(`/api/sessions/${entry.session.id}/codex/threads/${threadId}`, { method: "DELETE" });
    },
    onSuccess: async (result, { entry }) => {
      if (result.threads.length === 0) {
        onSessionDelete(entry.session.id);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["codex", entry.session.id] }),
      ]);
    },
  });

  const toggleProject = (projectId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  return (
    <nav className="grid gap-1">
      {entries.map((entry) => {
        const isOpen = expanded.has(entry.project.id);
        const isActiveProject = entry.project.id === activeProjectId;
        const projectRunning = entry.sessions.some((session) => session.status === "running");
        const loadingThreadLists = entry.sessions.some((session) => threadsBySessionId.get(session.id)?.isLoading);
        const hasThreads = entry.sessions.some((session) => (threadsBySessionId.get(session.id)?.data?.threads.length ?? 0) > 0);
        return (
          <div key={entry.project.id}>
            <div
              className={cn(
                "group grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md",
                isActiveProject && "bg-canvas",
              )}
            >
              <button
                className="flex min-h-8 items-center justify-center rounded-md px-1 text-ink hover:bg-canvas"
                type="button"
                title={isOpen ? `Collapse ${entry.project.name}` : `Expand ${entry.project.name}`}
                onClick={() => toggleProject(entry.project.id)}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button
                className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-md px-1 text-left text-sm text-ink hover:bg-canvas"
                type="button"
                onClick={() => selectProject(entry)}
              >
                <Folder size={15} />
                <span className="truncate">{entry.project.name}</span>
                {projectRunning ? <Loader2 className="shrink-0 animate-spin text-muted motion-reduce:animate-none" size={12} /> : null}
              </button>
              <Button
                title={`New chat in ${entry.project.name}`}
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={createChatSession.isPending}
                onClick={() => createChatSession.mutate(entry)}
              >
                <MessageSquarePlus data-icon="inline-start" />
              </Button>
              <Button
                className="opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                title={`Remove ${entry.project.name}`}
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onProjectDelete(entry.project.id)}
              >
                <Trash2 data-icon="inline-start" />
              </Button>
            </div>
            {isOpen ? (
              <div className="mt-1 grid gap-1 pl-8">
                {entry.sessions.map((session) => {
                  const sessionEntry = { project: entry.project, session };
                  const query = threadsBySessionId.get(session.id);
                  const threads = query?.data;
                  if (!threads?.threads.length) return null;
                  const activeThread = threads?.threads.find((thread) => thread.id === threads.activeThreadId) ?? threads?.threads[0];
                  const active = session.id === activeSessionId;
                  return (
                    <div
                      className={cn(
                        "group grid min-h-8 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md text-sm text-muted hover:bg-canvas",
                        active && "bg-canvas text-ink",
                      )}
                      data-testid="project-chat-session"
                      key={session.id}
                    >
                      <button
                        className="inline-flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-left"
                        type="button"
                        onClick={() => {
                          selectThread.mutate({ entry: sessionEntry, threadId: activeThread.id });
                        }}
                      >
                        <MessageSquare size={14} />
                        <span className="truncate">{activeThread.title}</span>
                        <SessionSignal events={codexEvents[session.id] ?? EMPTY_CODEX_EVENTS} session={session} />
                      </button>
                      <span className="text-[11px] text-muted">{formatRelativeTime(activeThread.lastActiveAt)}</span>
                      <Button
                        className="opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                        title={`Delete ${activeThread.title}`}
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={deleteThread.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteThread.mutate({ entry: sessionEntry, threadId: activeThread.id });
                        }}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  );
                })}
                {loadingThreadLists ? <p className="m-0 px-2 py-1 text-xs text-muted">Loading chats.</p> : null}
                {!loadingThreadLists && !hasThreads ? (
                  <button
                    className="rounded-md px-2 py-2 text-left text-xs font-medium text-muted hover:bg-canvas hover:text-primary"
                    type="button"
                    onClick={() => createChatSession.mutate(entry)}
                  >
                    No chats yet. Start a new chat.
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {projects.length === 0 ? <p className="m-0 px-2 py-2 text-xs text-muted">Add a project to start chat history.</p> : null}
    </nav>
  );
}

function SessionSignal({ events, session }: { events: typeof EMPTY_CODEX_EVENTS; session: Session }) {
  const signal = codexSessionSignal(session, events);
  if (signal.kind === "idle") return null;
  if (signal.kind === "running") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted" title={signal.label}>
        <Loader2 className="animate-spin motion-reduce:animate-none" size={12} />
        {signal.label}
      </span>
    );
  }
  if (signal.kind === "requested") return <span className="shrink-0 text-[11px] text-codex">{signal.label}</span>;
  if (signal.kind === "error") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-destructive" title={signal.label}>
        <CircleAlert size={12} />
        {signal.label}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary" title={signal.label}>
      <Circle className="fill-primary" size={10} />
      {signal.label}
    </span>
  );
}

function sessionsForProject(project: Project, sessions: Session[]) {
  return sessions
    .filter((session) => session.projectId === project.id || session.cwd === project.cwd || session.cwd.startsWith(`${project.cwd.replace(/\/+$/, "")}/`))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
