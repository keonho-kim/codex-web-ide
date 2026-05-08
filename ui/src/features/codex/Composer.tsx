import { useMemo, useState, type KeyboardEvent } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { buttonClass, selectedListButtonClass, transparentListButtonClass } from "../../components/uiClasses";
import { api } from "../../lib/api";
import type { ComposerMention } from "../../lib/types";
import { mentionKey, mentionLabel, parseMentionSearch, type MentionSearch } from "./mentionUtils";

export function Composer({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [mentionSearch, setMentionSearch] = useState<MentionSearch | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<ComposerMention[]>([]);
  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[92px] w-full rounded-md border border-[#d8d8df] bg-white px-2.5 py-1.5 pr-32 text-sm text-[#1d1d1f] outline-none [&_p]:m-0",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setDraft(text);
      setMentionSearch(parseMentionSearch(text));
    },
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
      editor?.commands.clearContent();
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
    const nextText = draft.replace(/(^|\s)([@$])([^\s@$]*)$/, "$1");
    editor?.commands.setContent(nextText ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: nextText }] }] } : "");
    setDraft(nextText);
    setMentionSearch(null);
    editor?.commands.focus();
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
    <div className="relative" onKeyDown={onComposerKeyDown}>
      <div className="mb-1 flex flex-wrap gap-1">
        {selectedMentions.map((mention) => (
          <button
            className="inline-flex min-h-6 items-center rounded-md border border-[#d8d8df] bg-white px-2 py-0.5 text-xs text-[#0066cc]"
            key={mentionKey(mention)}
            type="button"
            onClick={() => setSelectedMentions((items) => items.filter((item) => mentionKey(item) !== mentionKey(mention)))}
          >
            {mentionLabel(mention)}
          </button>
        ))}
      </div>
      <div className="relative">
        {!draft ? <span className="pointer-events-none absolute top-2 left-2.5 text-sm text-[#7a7a7a]">Ask Codex. Use @ for files and $ for skills.</span> : null}
        <EditorContent editor={editor} />
        <button
          className={`${buttonClass} absolute right-2 bottom-2`}
          type="button"
          disabled={!sessionId || !draft.trim() || runCodex.isPending}
          onClick={() => runCodex.mutate()}
        >
          <Play size={15} />
          Run
        </button>
        {runCodex.isPending ? (
          <button className={`${buttonClass} absolute right-[76px] bottom-2`} type="button" disabled={cancelCodex.isPending} onClick={() => cancelCodex.mutate()}>
            Cancel
          </button>
        ) : null}
      </div>
      {mentionSearch && suggestions.length > 0 ? (
        <div className="absolute right-0 bottom-24 left-0 max-h-[180px] overflow-auto rounded-md bg-[#1d1d1f] p-2 text-[11px] text-white">
          {suggestions.map((mention, index) => (
            <button
              className={`${transparentListButtonClass} text-white ${index === mentionSearch.selectedIndex ? selectedListButtonClass : ""}`}
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
  );
}
