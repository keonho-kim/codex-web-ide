import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, MessageSquare, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import type { CodexThreadRecord, Project, Session } from "../../lib/types";

type ThreadListResponse = {
  threads: CodexThreadRecord[];
  activeThreadId: string | null;
};

type ProjectEntry = {
  project: Project;
  session?: Session;
};

export function ProjectThreadTree({
  activeProjectId,
  activeSessionId,
  onProjectDelete,
  onProjectSelect,
  onSessionSelect,
  projects,
  sessions,
}: {
  activeProjectId?: string;
  activeSessionId?: string;
  onProjectDelete(id: string): void;
  onProjectSelect(id: string): void;
  onSessionSelect(id: string): void;
  projects: Project[];
  sessions: Session[];
}) {
  const queryClient = useQueryClient();
  const entries = useMemo(() => projects.map((project) => ({ project, session: primarySessionForProject(project, sessions) })), [projects, sessions]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeProjectId ? [activeProjectId] : []));

  useEffect(() => {
    if (!activeProjectId) return;
    setExpanded((current) => new Set(current).add(activeProjectId));
  }, [activeProjectId]);

  const threadQueries = useQueries({
    queries: entries.map((entry) => ({
      queryKey: ["codex", entry.session?.id, "threads"],
      queryFn: () => api<ThreadListResponse>(`/api/sessions/${entry.session?.id}/codex/threads`),
      enabled: Boolean(entry.session?.id),
    })),
  });

  const createThread = useMutation({
    mutationFn: async (entry: ProjectEntry) => {
      const session = entry.session ?? (await api<Session>("/api/sessions", { method: "POST", body: { projectId: entry.project.id } }));
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

  const ensureProjectSession = async (entry: ProjectEntry) => {
    const session = entry.session ?? (await api<Session>("/api/sessions", { method: "POST", body: { projectId: entry.project.id } }));
    onProjectSelect(entry.project.id);
    onSessionSelect(session.id);
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const selectThread = useMutation({
    mutationFn: async ({ entry, threadId }: { entry: ProjectEntry; threadId: string }) => {
      if (!entry.session) throw new Error("Project session not found.");
      const thread = await api<CodexThreadRecord>(`/api/sessions/${entry.session.id}/codex/threads/${threadId}/select`, { method: "POST" });
      return { entry, thread };
    },
    onSuccess: async ({ entry }) => {
      if (!entry.session) return;
      onProjectSelect(entry.project.id);
      onSessionSelect(entry.session.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["codex", entry.session.id] }),
      ]);
    },
  });

  const deleteThread = useMutation({
    mutationFn: async ({ entry, threadId }: { entry: ProjectEntry; threadId: string }) => {
      if (!entry.session) throw new Error("Project session not found.");
      return api<ThreadListResponse>(`/api/sessions/${entry.session.id}/codex/threads/${threadId}`, { method: "DELETE" });
    },
    onSuccess: async (_result, { entry }) => {
      if (!entry.session) return;
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
      {entries.map((entry, index) => {
        const isOpen = expanded.has(entry.project.id);
        const threads = threadQueries[index].data;
        const isActiveProject = entry.project.id === activeProjectId;
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
                onClick={() => void ensureProjectSession(entry)}
              >
                <Folder size={15} />
                <span className="truncate">{entry.project.name}</span>
              </button>
              <Button
                title={`New chat in ${entry.project.name}`}
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={createThread.isPending}
                onClick={() => createThread.mutate(entry)}
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
                {threads?.threads.map((thread) => {
                  const active = entry.session?.id === activeSessionId && thread.id === threads.activeThreadId;
                  return (
                    <div
                      className={cn(
                        "group grid min-h-8 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md text-sm text-muted hover:bg-canvas",
                        active && "bg-canvas text-ink",
                      )}
                      key={thread.id}
                    >
                      <button className="inline-flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-left" type="button" onClick={() => selectThread.mutate({ entry, threadId: thread.id })}>
                        <MessageSquare size={14} />
                        <span className="truncate">{thread.title}</span>
                      </button>
                      <span className="text-[11px] text-muted">{formatRelativeTime(thread.lastActiveAt)}</span>
                      <Button
                        className="opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                        title={`Delete ${thread.title}`}
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={deleteThread.isPending}
                        onClick={() => deleteThread.mutate({ entry, threadId: thread.id })}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  );
                })}
                {entry.session && threadQueries[index].isLoading ? <p className="m-0 px-2 py-1 text-xs text-muted">Loading chats.</p> : null}
                {entry.session && !threadQueries[index].isLoading && threads?.threads.length === 0 ? (
                  <button
                    className="rounded-md px-2 py-2 text-left text-xs font-medium text-muted hover:bg-canvas hover:text-primary"
                    type="button"
                    onClick={() => createThread.mutate(entry)}
                  >
                    No threads yet. Start a new thread.
                  </button>
                ) : null}
                {!entry.session ? <p className="m-0 px-2 py-1 text-xs text-muted">No chats yet.</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {projects.length === 0 ? <p className="m-0 px-2 py-2 text-xs text-muted">Add a project to start chat history.</p> : null}
    </nav>
  );
}

function primarySessionForProject(project: Project, sessions: Session[]) {
  return sessions
    .filter((session) => session.projectId === project.id || session.cwd === project.cwd || session.cwd.startsWith(`${project.cwd.replace(/\/+$/, "")}/`))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
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
