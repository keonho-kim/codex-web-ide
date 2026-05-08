import { useQuery } from "@tanstack/react-query";
import { SectionTitle } from "../../components/SectionTitle";
import { api } from "../../lib/api";
import type { CodexMessage, CodexThreadRecord } from "../../lib/types";
import { Composer } from "./Composer";

export function CodexPane({ sessionId }: { sessionId?: string }) {
  const messages = useQuery({
    queryKey: ["codex", sessionId, "messages"],
    queryFn: () => api<CodexMessage[]>(`/api/sessions/${sessionId}/codex/messages`),
    enabled: Boolean(sessionId),
  });
  const status = useQuery({
    queryKey: ["codex", sessionId, "resume"],
    queryFn: () => api<{ running: boolean; messages: CodexMessage[]; thread: CodexThreadRecord }>(`/api/sessions/${sessionId}/codex/resume`, { method: "POST" }),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => (query.state.data?.running ? 1000 : false),
  });

  return (
    <section className="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)_112px] overflow-hidden border-r border-hairline bg-canvas p-2.5">
      <SectionTitle label={status.data?.thread.title || "Codex"} />
      <div className="overflow-auto rounded-md border border-subtle p-2.5">
        {messages.data?.length ? (
          messages.data.map((message) => (
            <article className="border-b border-subtle py-2 last:border-b-0" key={message.id}>
              <strong className="mb-1 block text-xs text-primary capitalize">{message.role}</strong>
              <p className="m-0 text-[13px] leading-[1.45] whitespace-pre-wrap">{message.text}</p>
            </article>
          ))
        ) : (
          <p className="text-xs text-muted">Start a Codex run from the composer.</p>
        )}
      </div>
      <Composer sessionId={sessionId} running={status.data?.running ?? false} />
    </section>
  );
}
