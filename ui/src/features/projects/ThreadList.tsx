import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import type { CodexThreadRecord } from "../../lib/types";

type ThreadListResponse = {
  threads: CodexThreadRecord[];
  activeThreadId: string;
};

export function ThreadList({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const threads = useQuery({
    queryKey: ["codex", sessionId, "threads"],
    queryFn: () => api<ThreadListResponse>(`/api/sessions/${sessionId}/codex/threads`),
    enabled: Boolean(sessionId),
  });
  const refreshCodex = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["codex", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    ]);
  };
  const createThread = useMutation({
    mutationFn: () => api<CodexThreadRecord>(`/api/sessions/${sessionId}/codex/threads`, { method: "POST", body: {} }),
    onSuccess: refreshCodex,
  });
  const selectThread = useMutation({
    mutationFn: (threadId: string) => api<CodexThreadRecord>(`/api/sessions/${sessionId}/codex/threads/${threadId}/select`, { method: "POST" }),
    onSuccess: refreshCodex,
  });

  return (
    <nav className="grid gap-1">
      <Button
        className="w-full justify-start overflow-hidden"
        variant="outline"
        size="sm"
        type="button"
        disabled={!sessionId || createThread.isPending}
        onClick={() => createThread.mutate()}
      >
        <MessageSquarePlus data-icon="inline-start" />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">New thread</span>
      </Button>
      {threads.data?.threads.map((thread) => (
        <button
          className={cn(
            "inline-flex min-h-7 w-full items-center justify-start gap-1.5 overflow-hidden rounded-md border border-transparent bg-transparent px-2.5 py-1 text-left text-sm text-ink hover:bg-page",
            thread.id === threads.data.activeThreadId && "border-selected-border bg-selected text-primary",
          )}
          key={thread.id}
          type="button"
          onClick={() => selectThread.mutate(thread.id)}
        >
          <MessagesSquare size={15} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{thread.title}</span>
        </button>
      ))}
      {!sessionId ? <p className="text-xs text-muted">Create a session to use threads.</p> : null}
    </nav>
  );
}
