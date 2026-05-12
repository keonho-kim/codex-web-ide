import { useQuery } from "@tanstack/react-query";
import { SectionTitle } from "@/components/SectionTitle";
import { api } from "@/lib/api";
import type { CodexMessage, CodexThreadRecord } from "@/lib/types";
import { CodexTimeline } from "@/features/codex/CodexTimeline";
import { Composer } from "@/features/codex/Composer";

export function CodexPane({
  activeProjectId,
  onSessionCreated,
  sessionId,
}: {
  activeProjectId?: string;
  onSessionCreated(sessionId: string): void;
  sessionId?: string;
}) {
  const messages = useQuery({
    queryKey: ["codex", sessionId, "messages"],
    queryFn: () => api<CodexMessage[]>(`/api/sessions/${sessionId}/codex/messages`),
    enabled: Boolean(sessionId),
  });
  const status = useQuery({
    queryKey: ["codex", sessionId, "resume"],
    queryFn: () => api<{ running: boolean; messages: CodexMessage[]; thread: CodexThreadRecord | null }>(`/api/sessions/${sessionId}/codex/resume`, { method: "POST" }),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => (query.state.data?.running ? 1000 : false),
  });

  return (
    <section className="grid h-full min-w-0 grid-rows-[44px_minmax(0,1fr)_auto] gap-4 overflow-hidden bg-canvas p-4 max-[700px]:gap-3 max-[700px]:p-3">
      <div className="flex items-center justify-between rounded-md border border-codex-soft bg-codex-soft px-3">
        <SectionTitle label={status.data?.thread?.title || "Codex"} />
        <span className="text-[11px] text-codex">{status.data?.running ? "running" : "ready"}</span>
      </div>
      <CodexTimeline messages={messages.data ?? []} running={status.data?.running ?? false} sessionId={sessionId} />
      <Composer activeProjectId={activeProjectId} onSessionCreated={onSessionCreated} sessionId={sessionId} running={status.data?.running ?? false} />
    </section>
  );
}
