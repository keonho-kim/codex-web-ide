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
    <nav className="nav-list">
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
            "nav-item",
            thread.id === threads.data.activeThreadId && "nav-item-selected",
          )}
          key={thread.id}
          type="button"
          onClick={() => selectThread.mutate(thread.id)}
        >
          <MessagesSquare size={15} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{thread.title}</span>
        </button>
      ))}
      {!sessionId ? <p className="empty-state">Create a session to use threads.</p> : null}
    </nav>
  );
}
