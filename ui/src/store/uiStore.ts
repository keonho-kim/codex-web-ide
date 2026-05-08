import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ComposerMention, MentionPopupState } from "../lib/types";

export type CodexEventSummary = {
  id: string;
  label: string;
  detail?: string;
  timestamp: number;
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
  setWorkbenchLayout(layout: number[]): void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      openFilePaths: [],
      codexEvents: {},
      composerDraft: "",
      composerMentions: [],
      mentionPopup: null,
      editorDrafts: {},
      editorSyncedContents: {},
      selectedPanel: "git",
      sidebarCollapsed: false,
      workbenchLayout: [18, 52, 30],
      setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
      setActiveSessionId: (activeSessionId) =>
        set((state) =>
          state.activeSessionId === activeSessionId
            ? { activeSessionId }
            : {
                activeSessionId,
                activeFilePath: undefined,
                composerDraft: "",
                composerMentions: [],
                editorDrafts: {},
                editorSyncedContents: {},
                mentionPopup: null,
                openFilePaths: [],
                selectedPreviewId: undefined,
              },
        ),
      setActiveFilePath: (activeFilePath) =>
        set((state) => ({
          activeFilePath,
          openFilePaths: activeFilePath && !state.openFilePaths.includes(activeFilePath) ? [...state.openFilePaths, activeFilePath] : state.openFilePaths,
        })),
      setComposerDraft: (composerDraft) => set({ composerDraft }),
      setComposerMentions: (composerMentions) => set({ composerMentions }),
      setMentionPopup: (mentionPopup) => set({ mentionPopup }),
      clearComposer: () => set({ composerDraft: "", composerMentions: [], mentionPopup: null }),
      appendCodexEvent: (sessionId, event) =>
        set((state) => ({
          codexEvents: {
            ...state.codexEvents,
            [sessionId]: [...(state.codexEvents[sessionId] ?? []), event].slice(-12),
          },
        })),
      clearCodexEvents: (sessionId) =>
        set((state) => {
          const { [sessionId]: _discarded, ...codexEvents } = state.codexEvents;
          return { codexEvents };
        }),
      setEditorDraft: (path, content) =>
        set((state) => ({
          editorDrafts: { ...state.editorDrafts, [path]: content },
        })),
      hydrateEditorDraft: (path, content) =>
        set((state) => {
          const currentDraft = state.editorDrafts[path];
          const previousContent = state.editorSyncedContents[path];
          const shouldUpdateDraft = currentDraft === undefined || currentDraft === previousContent;
          return {
            editorDrafts: shouldUpdateDraft ? { ...state.editorDrafts, [path]: content } : state.editorDrafts,
            editorSyncedContents: { ...state.editorSyncedContents, [path]: content },
          };
        }),
      discardEditorDraft: (path) =>
        set((state) => {
          const { [path]: _discarded, ...editorDrafts } = state.editorDrafts;
          const { [path]: _synced, ...editorSyncedContents } = state.editorSyncedContents;
          return { editorDrafts, editorSyncedContents };
        }),
      closeFilePath: (path) =>
        set((state) => {
          const openFilePaths = state.openFilePaths.filter((item) => item !== path);
          const activeFilePath = state.activeFilePath === path ? openFilePaths.at(-1) : state.activeFilePath;
          return { activeFilePath, openFilePaths };
        }),
      setSelectedPanel: (selectedPanel) => set({ selectedPanel }),
      setSelectedPreviewId: (selectedPreviewId) => set({ selectedPreviewId }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setWorkbenchLayout: (workbenchLayout) => set({ workbenchLayout }),
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
        workbenchLayout: state.workbenchLayout,
      }),
    },
  ),
);
