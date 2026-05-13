import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { CodexSlashCommandDefinition, CodexSlashCommandResult, ComposerMention, Session } from "@/lib/types";
import { useUiStore } from "@/store/uiStore";
import { mentionKey, parseMentionSearch } from "@/features/codex/mentionUtils";

export function useComposer({
  activeProjectId,
  onSessionCreated,
  sessionId,
}: {
  activeProjectId?: string;
  onSessionCreated?(sessionId: string): void;
  sessionId?: string;
}) {
  const queryClient = useQueryClient();
  const draft = useUiStore((state) => state.composerDraft);
  const mentionSearch = useUiStore((state) => state.mentionPopup);
  const selectedMentions = useUiStore((state) => state.composerMentions);
  const setDraft = useUiStore((state) => state.setComposerDraft);
  const setMentionSearch = useUiStore((state) => state.setMentionPopup);
  const setSelectedMentions = useUiStore((state) => state.setComposerMentions);
  const clearComposer = useUiStore((state) => state.clearComposer);
  const setControlTab = useUiStore((state) => state.setControlTab);
  const setWorkbenchTab = useUiStore((state) => state.setWorkbenchTab);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [activeSlashCommand, setActiveSlashCommand] = useState<CodexSlashCommandDefinition | null>(null);
  const [slashDialogOpen, setSlashDialogOpen] = useState(false);
  const allowNextParagraphInput = useRef(false);
  const activeMentionSearch = mentionSearch ?? parseMentionSearch(draft);

  const editor = useEditor({
    extensions: [StarterKit],
    content: draft,
    editorProps: {
      attributes: {
        class: "max-h-[180px] min-h-[88px] w-full overflow-y-auto rounded-t-md bg-canvas px-2.5 py-2 text-sm text-ink outline-none max-[700px]:min-h-[76px] [&_p]:m-0",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editorText(editor);
      setDraft(text);
      setMentionSearch(parseMentionSearch(text));
    },
  });

  useEffect(() => {
    if (!editor || editorText(editor) === draft) return;
    editor.commands.setContent(textDocument(draft), { emitUpdate: false });
  }, [draft, editor]);

  const fileMentions = useQuery({
    queryKey: ["mentions", "files", sessionId, activeMentionSearch?.query],
    queryFn: () =>
      api<Array<{ type: "file"; path: string; isDirectory: boolean }>>(
        `/api/sessions/${sessionId}/mentions/files?q=${encodeURIComponent(activeMentionSearch?.query || "")}`,
      ),
    enabled: Boolean(sessionId && activeMentionSearch?.trigger === "@"),
  });
  const skillMentions = useQuery({
    queryKey: ["mentions", "skills", sessionId, activeMentionSearch?.query],
    queryFn: () =>
      api<Array<{ type: "skill"; id: string; name: string }>>(
        `/api/sessions/${sessionId}/mentions/skills?q=${encodeURIComponent(activeMentionSearch?.query || "")}`,
      ),
    enabled: Boolean(sessionId && activeMentionSearch?.trigger === "$"),
  });
  const suggestions = useMemo<ComposerMention[]>(() => {
    if (activeMentionSearch?.trigger === "@") return fileMentions.data ?? [];
    if (activeMentionSearch?.trigger === "$") return skillMentions.data ?? [];
    return [];
  }, [activeMentionSearch?.trigger, fileMentions.data, skillMentions.data]);
  const slashCommands = useQuery({
    queryKey: ["codex", "slash-commands"],
    queryFn: () => api<CodexSlashCommandDefinition[]>("/api/codex/slash-commands"),
  });
  const slashSearch = useMemo(() => parseSlashSearch(draft), [draft]);
  const slashSuggestions = useMemo(() => {
    if (slashSearch === null) return [];
    const query = slashSearch.toLowerCase();
    return (slashCommands.data ?? [])
      .filter((command) => command.command.includes(query) || command.description.toLowerCase().includes(query))
      .sort((a, b) => commandRank(a, query) - commandRank(b, query));
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
      if (result.status || result.command === "status") {
        setWorkbenchTab("system");
        setControlTab("usage");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["codex", sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["codex", sessionId, "status"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      ]);
    },
  });

  const runCodex = useMutation({
    mutationFn: async () => {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        if (!activeProjectId) throw new Error("Select a project before starting Codex.");
        const session = await api<Session>("/api/sessions", { method: "POST", body: { projectId: activeProjectId } });
        targetSessionId = session.id;
        onSessionCreated?.(session.id);
      }
      await api(`/api/sessions/${targetSessionId}/codex/run`, {
        method: "POST",
        body: { prompt: draft, mentions: selectedMentions },
      });
      return { sessionId: targetSessionId };
    },
    onMutate: () => {
      const previousDraft = draft;
      const previousMentions = selectedMentions;
      editor?.commands.clearContent();
      clearComposer();
      return { previousDraft, previousMentions };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousDraft && !context?.previousMentions.length) return;
      editor?.commands.setContent(textDocument(context.previousDraft));
      setDraft(context.previousDraft);
      setSelectedMentions(context.previousMentions);
    },
    onSuccess: async ({ sessionId: targetSessionId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["codex", targetSessionId] }),
        queryClient.invalidateQueries({ queryKey: ["codex", targetSessionId, "threads"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      ]);
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
    if (command.nativeSurface === "tab") {
      editor?.commands.clearContent();
      clearComposer();
      setWorkbenchTab("system");
      setControlTab("usage");
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

  const submitComposer = () => {
    if (!draft.trim() || runCodex.isPending || slashCommand.isPending) return;
    if (!sessionId && !activeProjectId) return;
    const parsed = parseSlashInvocation(draft, slashCommands.data ?? []);
    if (parsed) {
      if (!sessionId) return;
      if (parsed.command.nativeSurface === "modal" || (parsed.command.requiresConfirmation && !parsed.args)) {
        setActiveSlashCommand(parsed.command);
        setSlashDialogOpen(true);
      } else {
        if (parsed.command.nativeSurface === "tab") {
          editor?.commands.clearContent();
          clearComposer();
          setWorkbenchTab("system");
          setControlTab("usage");
        }
        slashCommand.mutate({ command: parsed.command.command, args: parsed.args });
      }
      return;
    }
    runCodex.mutate();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, running = false) => {
    if (isComposingKeyboardEvent(event)) return;
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
    if (activeMentionSearch && suggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setMentionSearch({ ...activeMentionSearch, selectedIndex: (activeMentionSearch.selectedIndex + direction + suggestions.length) % suggestions.length });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        addMention(suggestions[activeMentionSearch.selectedIndex] ?? suggestions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionSearch(null);
        return;
      }
    }
    if (event.defaultPrevented || running) return;
    if (event.key !== "Enter") return;
    if (event.shiftKey) {
      allowNextParagraphInput.current = true;
      window.setTimeout(() => {
        allowNextParagraphInput.current = false;
      }, 0);
      return;
    }
    event.preventDefault();
    submitComposer();
  };

  const onBeforeInput = (event: FormEvent<HTMLDivElement>, running = false) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (running || nativeEvent.isComposing) return;
    if (nativeEvent.inputType !== "insertParagraph" && nativeEvent.inputType !== "insertLineBreak") return;
    if (slashSuggestions.length > 0) {
      event.preventDefault();
      selectSlashCommand(slashSuggestions[selectedSlashIndex] ?? slashSuggestions[0]);
      return;
    }
    if (activeMentionSearch && suggestions.length > 0) {
      event.preventDefault();
      addMention(suggestions[activeMentionSearch.selectedIndex] ?? suggestions[0]);
      return;
    }
    if (allowNextParagraphInput.current) {
      allowNextParagraphInput.current = false;
      return;
    }
    event.preventDefault();
    submitComposer();
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
    activeMentionSearch,
    onBeforeInput,
    onKeyDown,
    removeMention,
    runCodex: submitComposer,
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

export function textDocument(text: string) {
  return text
    ? {
        type: "doc",
        content: text.split(/\r?\n/).map((line) => ({
          type: "paragraph",
          ...(line ? { content: [{ type: "text", text: line }] } : {}),
        })),
      }
    : "";
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

function commandRank(command: CodexSlashCommandDefinition, query: string) {
  if (!query) return 0;
  if (command.command === query) return 0;
  if (command.command.startsWith(query)) return 1;
  if (command.command.includes(query)) return 2;
  return 3;
}

export function editorText(editor: { getText(options?: { blockSeparator?: string }): string }) {
  return editor.getText({ blockSeparator: "\n" });
}

function isComposingKeyboardEvent(event: KeyboardEvent<HTMLDivElement>) {
  return event.nativeEvent.isComposing || event.key === "Process" || event.keyCode === 229;
}
