import { useMemo, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { SectionTitle } from "../../components/SectionTitle";
import { api } from "../../lib/api";
import type { CodexMessage, ComposerMention } from "../../lib/types";

type MentionSearch = {
  trigger: "@" | "$";
  query: string;
  selectedIndex: number;
};

export function CodexPane({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [mentionSearch, setMentionSearch] = useState<MentionSearch | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<ComposerMention[]>([]);
  const messages = useQuery({
    queryKey: ["codex", sessionId, "messages"],
    queryFn: () => api<CodexMessage[]>(`/api/sessions/${sessionId}/codex/messages`),
    enabled: Boolean(sessionId),
  });
  const fileMentions = useQuery({
    queryKey: ["mentions", "files", sessionId, mentionSearch?.query],
    queryFn: () =>
      api<Array<{ type: "file"; path: string; isDirectory: boolean }>>(
        `/api/sessions/${sessionId}/mentions/files?q=${encodeURIComponent(mentionSearch?.query || "")}`,
      ),
    enabled: Boolean(sessionId && mentionSearch?.trigger === "@"),
  });
  const skillMentions = useQuery({
    queryKey: ["mentions", "skills", sessionId, mentionSearch?.query],
    queryFn: () =>
      api<Array<{ type: "skill"; id: string; name: string }>>(
        `/api/sessions/${sessionId}/mentions/skills?q=${encodeURIComponent(mentionSearch?.query || "")}`,
      ),
    enabled: Boolean(sessionId && mentionSearch?.trigger === "$"),
  });
  const suggestions = useMemo<ComposerMention[]>(() => {
    if (mentionSearch?.trigger === "@") return fileMentions.data ?? [];
    if (mentionSearch?.trigger === "$") return skillMentions.data ?? [];
    return [];
  }, [fileMentions.data, mentionSearch?.trigger, skillMentions.data]);
  const runCodex = useMutation({
    mutationFn: () =>
      api(`/api/sessions/${sessionId}/codex/run`, {
        method: "POST",
        body: { prompt: draft, mentions: selectedMentions },
      }),
    onSuccess: async () => {
      setDraft("");
      setSelectedMentions([]);
      setMentionSearch(null);
      await queryClient.invalidateQueries({ queryKey: ["codex", sessionId] });
    },
  });
  const cancelCodex = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/codex/cancel`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["codex", sessionId] });
    },
  });

  const addMention = (mention: ComposerMention) => {
    setSelectedMentions((items) => (items.some((item) => mentionKey(item) === mentionKey(mention)) ? items : [...items, mention]));
    setDraft((value) => value.replace(/(^|\s)([@$])([^\s@$]*)$/, "$1"));
    setMentionSearch(null);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionSearch || suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setMentionSearch((current) =>
        current ? { ...current, selectedIndex: (current.selectedIndex + direction + suggestions.length) % suggestions.length } : current,
      );
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      addMention(suggestions[mentionSearch.selectedIndex] ?? suggestions[0]);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setMentionSearch(null);
    }
  };

  return (
    <section className="pane chat-pane">
      <SectionTitle label="Codex" />
      <div className="chat-surface">
        {messages.data?.length ? (
          messages.data.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <strong>{message.role}</strong>
              <p>{message.text}</p>
            </article>
          ))
        ) : (
          <p className="empty">Start a Codex run from the composer.</p>
        )}
      </div>
      <div className="composer">
        <div className="mention-chips">
          {selectedMentions.map((mention) => (
            <button
              key={mentionKey(mention)}
              type="button"
              onClick={() => setSelectedMentions((items) => items.filter((item) => mentionKey(item) !== mentionKey(mention)))}
            >
              {mention.type === "file" ? `@${mention.path}` : `$${mention.name}`}
            </button>
          ))}
        </div>
        <textarea
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            setMentionSearch(parseMentionSearch(value));
          }}
          onKeyDown={onComposerKeyDown}
          placeholder="Ask Codex. Use @ for files and $ for skills."
        />
        <button className="composer-send" type="button" disabled={!sessionId || !draft.trim() || runCodex.isPending} onClick={() => runCodex.mutate()}>
          <Play size={15} />
          Run
        </button>
        {runCodex.isPending ? (
          <button className="composer-cancel" type="button" disabled={cancelCodex.isPending} onClick={() => cancelCodex.mutate()}>
            Cancel
          </button>
        ) : null}
        {mentionSearch && suggestions.length > 0 ? (
          <div className="mention-popover">
            {suggestions.map((mention, index) => (
              <button
                className={index === mentionSearch.selectedIndex ? "selected" : ""}
                key={mentionKey(mention)}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  addMention(mention);
                }}
              >
                {mentionLabel(mention)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function parseMentionSearch(value: string): MentionSearch | null {
  const match = /(^|\s)([@$])([^\s@$]*)$/.exec(value);
  if (!match) return null;
  return { trigger: match[2] as "@" | "$", query: match[3] ?? "", selectedIndex: 0 };
}

function mentionKey(mention: ComposerMention) {
  return mention.type === "file" ? `file:${mention.path}` : `skill:${mention.id}`;
}

function mentionLabel(mention: ComposerMention) {
  return mention.type === "file" ? `@${mention.path}` : `$${mention.name}`;
}
