import { useEffect, useMemo, type KeyboardEvent } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ComposerMention } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";
import { mentionKey, parseMentionSearch } from "./mentionUtils";

export function useComposer(sessionId?: string) {
  const queryClient = useQueryClient();
  const draft = useUiStore((state) => state.composerDraft);
  const mentionSearch = useUiStore((state) => state.mentionPopup);
  const selectedMentions = useUiStore((state) => state.composerMentions);
  const setDraft = useUiStore((state) => state.setComposerDraft);
  const setMentionSearch = useUiStore((state) => state.setMentionPopup);
  const setSelectedMentions = useUiStore((state) => state.setComposerMentions);
  const clearComposer = useUiStore((state) => state.clearComposer);

  const editor = useEditor({
    extensions: [StarterKit],
    content: draft,
    editorProps: {
      attributes: {
        class:
          "min-h-[92px] w-full rounded-md border border-control bg-canvas px-2.5 py-1.5 pr-32 text-sm text-ink outline-none [&_p]:m-0",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setDraft(text);
      setMentionSearch(parseMentionSearch(text));
    },
  });

  useEffect(() => {
    if (!editor || editor.getText() === draft) return;
    editor.commands.setContent(textDocument(draft), { emitUpdate: false });
  }, [draft, editor]);

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
      clearComposer();
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
    setSelectedMentions(selectedMentions.some((item) => mentionKey(item) === mentionKey(mention)) ? selectedMentions : [...selectedMentions, mention]);
    const nextText = draft.replace(/(^|\s)([@$])([^\s@$]*)$/, "$1");
    editor?.commands.setContent(textDocument(nextText));
    setDraft(nextText);
    setMentionSearch(null);
    editor?.commands.focus();
  };

  const removeMention = (mention: ComposerMention) => {
    setSelectedMentions(selectedMentions.filter((item) => mentionKey(item) !== mentionKey(mention)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!mentionSearch || suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setMentionSearch({ ...mentionSearch, selectedIndex: (mentionSearch.selectedIndex + direction + suggestions.length) % suggestions.length });
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

  return {
    addMention,
    cancelCodex: () => cancelCodex.mutate(),
    cancelPending: cancelCodex.isPending,
    draft,
    editor,
    mentionSearch,
    onKeyDown,
    removeMention,
    runCodex: () => runCodex.mutate(),
    runPending: runCodex.isPending,
    selectedMentions,
    suggestions,
  };
}

function textDocument(text: string) {
  return text ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } : "";
}
