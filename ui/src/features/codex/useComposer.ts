import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { CodexSlashCommandDefinition, CodexSlashCommandResult, ComposerMention, Session } from "@/lib/types";
import { useUiStore } from "@/store/uiStore";
import type { ComposerInputHandle } from "@/features/codex/ComposerTextarea";
import { mentionKey, mentionLabel, parseMentionSearch } from "@/features/codex/mentionUtils";

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
  const textareaRef = useRef<ComposerInputHandle | null>(null);
  const activeMentionSearch = mentionSearch ?? parseMentionSearch(draft);

  const updateDraft = (text: string, cursorIndex = text.length) => {
    const normalizedText = normalizeComposerDraft(text);
    const nextMentions = useUiStore.getState().composerMentions.filter((mention) => normalizedText.includes(mentionLabel(mention)));
    setDraft(normalizedText);
    if (nextMentions.length !== useUiStore.getState().composerMentions.length) setSelectedMentions(nextMentions);
    setMentionSearch(parseMentionSearch(normalizedText, cursorIndex));
  };

  const focusComposer = (cursorIndex?: number) => {
    textareaRef.current?.focusAt(cursorIndex);
  };

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
    onSuccess: (result) => {
      if (result.draft) {
        updateDraft(result.draft);
      } else {
        clearComposer();
      }
      if (result.status || result.command === "status") {
        setWorkbenchTab("system");
        setControlTab("usage");
      }
      void queryClient.invalidateQueries({ queryKey: ["codex", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["codex", sessionId, "status"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
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
      clearComposer();
      return { previousDraft, previousMentions };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousDraft && !context?.previousMentions.length) return;
      updateDraft(context.previousDraft);
      setSelectedMentions(context.previousMentions);
    },
    onSuccess: ({ sessionId: targetSessionId }) => {
      void queryClient.invalidateQueries({ queryKey: ["codex", targetSessionId, "resume"] });
      void queryClient.invalidateQueries({ queryKey: ["codex", targetSessionId, "threads"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
  const cancelCodex = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/codex/cancel`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["codex", sessionId, "resume"] });
    },
  });

  const addMention = (mention: ComposerMention) => {
    const search = activeMentionSearch ?? parseMentionSearch(draft, textareaRef.current?.selectionStart() ?? draft.length);
    if (!search) return;
    const nextMentions = selectedMentions.some((item) => mentionKey(item) === mentionKey(mention)) ? selectedMentions : [...selectedMentions, mention];
    const replacement = `${mentionLabel(mention)} `;
    const nextCursor = search.start + replacement.length;
    const nextText = `${draft.slice(0, search.start)}${replacement}${draft.slice(search.end)}`;
    setSelectedMentions(nextMentions);
    updateDraft(nextText, nextCursor);
    setMentionSearch(null);
    focusComposer(nextCursor);
  };

  const selectSlashCommand = (command: CodexSlashCommandDefinition) => {
    if (command.nativeSurface === "modal" || command.requiresConfirmation) {
      setActiveSlashCommand(command);
      setSlashDialogOpen(true);
      return;
    }
    if (command.supportsInlineArgs && command.nativeSurface === "composer") {
      const nextText = `/${command.command} `;
      updateDraft(nextText);
      focusComposer();
      return;
    }
    if (command.nativeSurface === "tab") {
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
        updateDraft("");
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
    if (event.shiftKey) return;
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
    error: runCodex.error ? getErrorMessage(runCodex.error) : cancelCodex.error ? getErrorMessage(cancelCodex.error) : slashCommand.error ? getErrorMessage(slashCommand.error) : null,
    mentionSearch,
    activeMentionSearch,
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
    textareaRef,
    updateDraft,
  };
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

export function normalizeComposerDraft(text: string) {
  return text.replace(/\r\n/g, "\n");
}

function isComposingKeyboardEvent(event: KeyboardEvent<HTMLDivElement>) {
  return event.nativeEvent.isComposing || event.key === "Process" || event.keyCode === 229;
}
