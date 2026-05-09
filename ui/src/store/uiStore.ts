import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ComposerMention, MentionPopupState } from "../lib/types";

export type CodexEventSummary = {
  id: string;
  label: string;
  detail?: string;
  timestamp: number;
};

export const DEFAULT_WORKBENCH_LAYOUT = [18, 52, 30];
export const EMPTY_CODEX_EVENTS: CodexEventSummary[] = [];
export type MainPanelKey = "files" | "editor" | "codex" | "bottom";
export type CollapsedMainPanels = Record<MainPanelKey, boolean>;
export const DEFAULT_COLLAPSED_MAIN_PANELS: CollapsedMainPanels = {
  files: false,
  editor: false,
  codex: false,
  bottom: false,
};

export type UiState = {
  activeProjectId?: string;
  activeSessionId?: string;
  activeFilePath?: string;
  composerDraft: string;
  codexEvents: Record<string, CodexEventSummary[]>;
  composerMentions: ComposerMention[];
  mentionPopup: MentionPopupState | null;
  editorDrafts: Record<string, string>;
  editorSyncedContents: Record<string, string>;
  openFilePaths: string[];
  selectedPanel: "preview" | "git" | "jobs" | "services";
  selectedPreviewId?: string;
  sidebarCollapsed: boolean;
  collapsedMainPanels: CollapsedMainPanels;
  workbenchLayout: number[];
  setActiveProjectId(id?: string): void;
  setActiveSessionId(id?: string): void;
  setActiveFilePath(path?: string): void;
  setComposerDraft(draft: string): void;
  setComposerMentions(mentions: ComposerMention[]): void;
  setMentionPopup(popup: MentionPopupState | null): void;
  clearComposer(): void;
  appendCodexEvent(sessionId: string, event: CodexEventSummary): void;
  clearCodexEvents(sessionId: string): void;
  setEditorDraft(path: string, content: string): void;
  hydrateEditorDraft(path: string, content: string): void;
  discardEditorDraft(path: string): void;
  closeFilePath(path: string): void;
  setSelectedPanel(panel: UiState["selectedPanel"]): void;
  setSelectedPreviewId(id?: string): void;
  setSidebarCollapsed(collapsed: boolean): void;
  toggleMainPanel(panel: MainPanelKey): void;
  setWorkbenchLayout(layout: number[]): void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      openFilePaths: [],
      codexEvents: {},
      composerDraft: "",
      composerMentions: [],
      mentionPopup: null,
      editorDrafts: {},
      editorSyncedContents: {},
      selectedPanel: "git",
      sidebarCollapsed: false,
      collapsedMainPanels: DEFAULT_COLLAPSED_MAIN_PANELS,
      workbenchLayout: DEFAULT_WORKBENCH_LAYOUT,
      setActiveProjectId: (activeProjectId) => {
        if (get().activeProjectId === activeProjectId) return;
        set({ activeProjectId });
      },
      setActiveSessionId: (activeSessionId) => {
        if (get().activeSessionId === activeSessionId) return;
        set({
          activeSessionId,
          activeFilePath: undefined,
          composerDraft: "",
          composerMentions: [],
          editorDrafts: {},
          editorSyncedContents: {},
          mentionPopup: null,
          openFilePaths: [],
          selectedPreviewId: undefined,
        });
      },
      setActiveFilePath: (activeFilePath) => {
        const state = get();
        const openFilePaths = activeFilePath && !state.openFilePaths.includes(activeFilePath) ? [...state.openFilePaths, activeFilePath] : state.openFilePaths;
        if (state.activeFilePath === activeFilePath && state.openFilePaths === openFilePaths) return;
        set({ activeFilePath, openFilePaths });
      },
      setComposerDraft: (composerDraft) => {
        if (get().composerDraft === composerDraft) return;
        set({ composerDraft });
      },
      setComposerMentions: (composerMentions) => {
        if (get().composerMentions === composerMentions) return;
        set({ composerMentions });
      },
      setMentionPopup: (mentionPopup) => {
        if (get().mentionPopup === mentionPopup) return;
        set({ mentionPopup });
      },
      clearComposer: () => {
        const state = get();
        if (!state.composerDraft && state.composerMentions.length === 0 && state.mentionPopup === null) return;
        set({ composerDraft: "", composerMentions: [], mentionPopup: null });
      },
      appendCodexEvent: (sessionId, event) =>
        set((state) => ({
          codexEvents: {
            ...state.codexEvents,
            [sessionId]: [...(state.codexEvents[sessionId] ?? []), event].slice(-12),
          },
        })),
      clearCodexEvents: (sessionId) =>
        set((state) => {
          if (!state.codexEvents[sessionId]) return state;
          const { [sessionId]: _discarded, ...codexEvents } = state.codexEvents;
          return { codexEvents };
        }),
      setEditorDraft: (path, content) => {
        if (get().editorDrafts[path] === content) return;
        set((state) => ({ editorDrafts: { ...state.editorDrafts, [path]: content } }));
      },
      hydrateEditorDraft: (path, content) =>
        set((state) => {
          const currentDraft = state.editorDrafts[path];
          const previousContent = state.editorSyncedContents[path];
          const shouldUpdateDraft = currentDraft === undefined || currentDraft === previousContent;
          if (!shouldUpdateDraft && previousContent === content) return state;
          if (shouldUpdateDraft && currentDraft === content && previousContent === content) return state;
          return {
            editorDrafts: shouldUpdateDraft ? { ...state.editorDrafts, [path]: content } : state.editorDrafts,
            editorSyncedContents: { ...state.editorSyncedContents, [path]: content },
          };
        }),
      discardEditorDraft: (path) =>
        set((state) => {
          if (!(path in state.editorDrafts) && !(path in state.editorSyncedContents)) return state;
          const { [path]: _discarded, ...editorDrafts } = state.editorDrafts;
          const { [path]: _synced, ...editorSyncedContents } = state.editorSyncedContents;
          return { editorDrafts, editorSyncedContents };
        }),
      closeFilePath: (path) =>
        set((state) => {
          if (!state.openFilePaths.includes(path) && state.activeFilePath !== path) return state;
          const openFilePaths = state.openFilePaths.filter((item) => item !== path);
          const activeFilePath = state.activeFilePath === path ? openFilePaths.at(-1) : state.activeFilePath;
          return { activeFilePath, openFilePaths };
        }),
      setSelectedPanel: (selectedPanel) => {
        if (get().selectedPanel === selectedPanel) return;
        set({ selectedPanel });
      },
      setSelectedPreviewId: (selectedPreviewId) => {
        if (get().selectedPreviewId === selectedPreviewId) return;
        set({ selectedPreviewId });
      },
      setSidebarCollapsed: (sidebarCollapsed) => {
        if (get().sidebarCollapsed === sidebarCollapsed) return;
        set({ sidebarCollapsed });
      },
      toggleMainPanel: (panel) => {
        const collapsedMainPanels = normalizeCollapsedMainPanels(get().collapsedMainPanels);
        const next = { ...collapsedMainPanels, [panel]: !collapsedMainPanels[panel] };
        if (panel !== "bottom" && next.files && next.editor && next.codex) next.codex = false;
        set({ collapsedMainPanels: next });
      },
      setWorkbenchLayout: (workbenchLayout) => {
        if (sameLayout(get().workbenchLayout, workbenchLayout)) return;
        set({ workbenchLayout });
      },
    }),
    {
      name: "codex-web-ui",
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        activeSessionId: state.activeSessionId,
        activeFilePath: state.activeFilePath,
        openFilePaths: state.openFilePaths,
        selectedPanel: state.selectedPanel,
        selectedPreviewId: state.selectedPreviewId,
        sidebarCollapsed: state.sidebarCollapsed,
        collapsedMainPanels: normalizeCollapsedMainPanels(state.collapsedMainPanels),
        workbenchLayout: state.workbenchLayout,
      }),
    },
  ),
);

export function selectCodexEvents(state: UiState, sessionId?: string) {
  return sessionId ? state.codexEvents[sessionId] ?? EMPTY_CODEX_EVENTS : EMPTY_CODEX_EVENTS;
}

function sameLayout(current: number[], next: number[]) {
  return current.length === next.length && current.every((value, index) => value === next[index]);
}

export function normalizeCollapsedMainPanels(value?: Partial<CollapsedMainPanels>) {
  return { ...DEFAULT_COLLAPSED_MAIN_PANELS, ...value };
}
