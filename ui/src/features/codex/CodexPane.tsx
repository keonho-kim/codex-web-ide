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
    queryFn: () => api<{ running: boolean; messages: CodexMessage[]; thread: CodexThreadRecord }>(`/api/sessions/${sessionId}/codex/resume`, { method: "POST" }),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => (query.state.data?.running ? 1000 : false),
  });

  return (
    <section className="grid h-full min-w-0 grid-rows-[40px_minmax(0,1fr)_68px_112px] gap-2 overflow-hidden border-r border-hairline bg-canvas p-2.5 max-[900px]:grid-rows-[38px_minmax(0,1fr)_104px] max-[900px]:border-r-0">
      <div className="flex items-center justify-between rounded-md border border-codex-soft bg-codex-soft px-2">
        <SectionTitle label={status.data?.thread.title || "Codex"} />
        <span className="text-[11px] text-codex">{status.data?.running ? "running" : "ready"}</span>
      </div>
      <div className="overflow-auto rounded-md border border-subtle bg-panel/60 p-2.5">
        {messages.data?.length ? (
          messages.data.map((message) => (
            <article className="mb-2 rounded-md border border-hairline bg-canvas px-3 py-2 last:mb-0" key={message.id}>
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
