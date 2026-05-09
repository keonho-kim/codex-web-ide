import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import type { CodexSlashCommandDefinition, CodexSlashCommandResult, ComposerMention } from "../../lib/types";
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
  const setWorkbenchTab = useUiStore((state) => state.setWorkbenchTab);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [activeSlashCommand, setActiveSlashCommand] = useState<CodexSlashCommandDefinition | null>(null);
  const [slashDialogOpen, setSlashDialogOpen] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: draft,
    editorProps: {
      attributes: {
        class: "min-h-[92px] w-full rounded-md border border-control bg-canvas px-2.5 py-1.5 pr-32 text-sm text-ink outline-none transition-colors focus:border-primary max-[700px]:min-h-[84px] [&_p]:m-0",
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
  const slashCommands = useQuery({
    queryKey: ["codex", "slash-commands"],
    queryFn: () => api<CodexSlashCommandDefinition[]>("/api/codex/slash-commands"),
  });
  const slashSearch = useMemo(() => parseSlashSearch(draft), [draft]);
  const slashSuggestions = useMemo(() => {
    if (!slashSearch) return [];
    const query = slashSearch.toLowerCase();
    return (slashCommands.data ?? [])
      .filter((command) => command.command.includes(query) || command.description.toLowerCase().includes(query))
      .slice(0, 10);
  }, [slashCommands.data, slashSearch]);

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashSearch]);

  const slashCommand = useMutation({
    mutationFn: ({ command, args, options }: { command: string; args?: string; options?: Record<string, unknown> }) =>
      api<CodexSlashCommandResult>(`/api/sessions/${sessionId}/codex/slash-command`, {
        method: "POST",
        body: { command, args: args ?? "", options: options ?? {} },
      }),
    onSuccess: async (result) => {
      if (result.draft) {
        editor?.commands.setContent(textDocument(result.draft));
        setDraft(result.draft);
      } else {
        editor?.commands.clearContent();
        clearComposer();
      }
      if (result.status || result.command === "status") setWorkbenchTab("usage");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["codex", sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["codex", sessionId, "status"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      ]);
    },
  });

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

  const selectSlashCommand = (command: CodexSlashCommandDefinition) => {
    if (command.nativeSurface === "modal" || command.requiresConfirmation) {
      setActiveSlashCommand(command);
      setSlashDialogOpen(true);
      return;
    }
    if (command.supportsInlineArgs && command.nativeSurface === "composer") {
      const nextText = `/${command.command} `;
      editor?.commands.setContent(textDocument(nextText));
      setDraft(nextText);
      editor?.commands.focus();
      return;
    }
    slashCommand.mutate({ command: command.command });
  };

  const applySlashCommand = (command: CodexSlashCommandDefinition, options: Record<string, unknown>, args?: string) => {
    slashCommand.mutate({ command: command.command, args, options });
    setSlashDialogOpen(false);
  };

  const removeMention = (mention: ComposerMention) => {
    setSelectedMentions(selectedMentions.filter((item) => mentionKey(item) !== mentionKey(mention)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (slashSuggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setSelectedSlashIndex((selectedSlashIndex + direction + slashSuggestions.length) % slashSuggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectSlashCommand(slashSuggestions[selectedSlashIndex] ?? slashSuggestions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        editor?.commands.setContent("");
        setDraft("");
        return;
      }
    }
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
    activeSlashCommand,
    applySlashCommand,
    cancelCodex: () => cancelCodex.mutate(),
    cancelPending: cancelCodex.isPending,
    draft,
    editor,
    error: runCodex.error ? getErrorMessage(runCodex.error) : cancelCodex.error ? getErrorMessage(cancelCodex.error) : slashCommand.error ? getErrorMessage(slashCommand.error) : null,
    mentionSearch,
    onKeyDown,
    removeMention,
    runCodex: () => {
      const parsed = parseSlashInvocation(draft, slashCommands.data ?? []);
      if (parsed) {
        if (parsed.command.nativeSurface === "modal" || (parsed.command.requiresConfirmation && !parsed.args)) {
          setActiveSlashCommand(parsed.command);
          setSlashDialogOpen(true);
        } else {
          slashCommand.mutate({ command: parsed.command.command, args: parsed.args });
        }
        return;
      }
      runCodex.mutate();
    },
    runPending: runCodex.isPending || slashCommand.isPending,
    selectedMentions,
    selectedSlashIndex,
    suggestions,
    slashDialogOpen,
    slashSuggestions,
    selectSlashCommand,
    setSlashDialogOpen,
  };
}

function textDocument(text: string) {
  return text ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } : "";
}

function parseSlashSearch(text: string) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("/") || /\s/.test(trimmed)) return null;
  return trimmed.slice(1);
}

function parseSlashInvocation(text: string, commands: CodexSlashCommandDefinition[]) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const match = /^\/([a-z0-9_-]+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!match) return null;
  const command = commands.find((item) => item.command === match[1]);
  return command ? { command, args: match[2] ?? "" } : null;
}
