import { useQuery } from "@tanstack/react-query";
import { SectionTitle } from "../../components/SectionTitle";
import { api } from "../../lib/api";
import type { CodexMessage, CodexThreadRecord } from "../../lib/types";
import { CommandSuggestion } from "./CommandSuggestion";
import { CodexEventStream } from "./CodexEventStream";
import { Composer } from "./Composer";

export function CodexPane({ sessionId }: { sessionId?: string }) {
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
    <section className="grid h-full min-w-0 grid-rows-[44px_minmax(0,1fr)_74px_124px] gap-4 overflow-hidden bg-canvas p-4 max-[900px]:grid-rows-[44px_minmax(0,1fr)_116px] max-[700px]:gap-3 max-[700px]:p-3">
      <div className="flex items-center justify-between rounded-md border border-codex-soft bg-codex-soft px-3">
        <SectionTitle label={status.data?.thread?.title || "Codex"} />
        <span className="text-[11px] text-codex">{status.data?.running ? "running" : "ready"}</span>
      </div>
      <div className="overflow-auto rounded-md border border-subtle bg-panel/60 p-4">
        {messages.data?.length ? (
          messages.data.map((message) => (
            <article className="mb-3 rounded-md border border-hairline bg-canvas px-4 py-3 last:mb-0" key={message.id}>
              <strong className="mb-1 block text-xs text-primary capitalize">{message.role}</strong>
              <p className="m-0 text-[13px] leading-[1.5] whitespace-pre-wrap">{message.text}</p>
              {message.role === "assistant" ? <CommandSuggestion sessionId={sessionId} text={message.text} /> : null}
            </article>
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-muted">Start a Codex run from the composer.</div>
        )}
      </div>
      <div className="min-h-0 max-[900px]:hidden">
        <CodexEventStream running={status.data?.running ?? false} sessionId={sessionId} />
      </div>
      <Composer sessionId={sessionId} running={status.data?.running ?? false} />
    </section>
  );
}
