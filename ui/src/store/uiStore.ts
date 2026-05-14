import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_STATUSLINE_ITEMS, normalizeStatuslineItems, type CodexStatusLineItem } from "@/lib/statusline";
import type { ComposerMention, MentionPopupState } from "@/lib/types";

export type CodexEventSummary = {
  id: string;
  kind?: "assistant" | "command" | "tool" | "file" | "reasoning" | "search" | "todo" | "error" | "turn" | "event";
  label: string;
  title?: string;
  status?: string;
  preview?: string;
  body?: string;
  detail?: string;
  messageId?: string;
  sourceItemId?: string;
  role?: "assistant" | "user" | "system";
  text?: string;
  timestamp: number;
};

export const DEFAULT_WORKBENCH_LAYOUT = [18, 52, 30];
export const EMPTY_CODEX_EVENTS: CodexEventSummary[] = [];
export type MainPanelKey = "files" | "editor" | "codex" | "bottom";
export type CollapsedMainPanels = Record<MainPanelKey, boolean>;
export type WorkbenchTab = "chat" | "editor" | "system";
export type ControlTab = "git" | "runtime" | "usage";
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
  workbenchTab: WorkbenchTab;
  controlTab: ControlTab;
  selectedPreviewId?: string;
  previewOpen: boolean;
  editorBottomPanelOpen: boolean;
  sidebarCollapsed: boolean;
  editorFilesCollapsed: boolean;
  collapsedMainPanels: CollapsedMainPanels;
  workbenchLayout: number[];
  codexCommandSettings: {
    statuslineItems: CodexStatusLineItem[];
    useThemeColors: boolean;
    titleItems: string[];
    experimentalFeatures: Record<string, boolean>;
    model: string;
    reasoningEffort: string;
    sandbox: string;
    approvals: string;
    vimMode: boolean;
    rawMode: boolean;
    theme: string;
  };
  codexCommandSettingOverrides: Partial<Record<keyof UiState["codexCommandSettings"], boolean>>;
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
  setWorkbenchTab(tab: WorkbenchTab): void;
  setControlTab(tab: ControlTab): void;
  setSelectedPreviewId(id?: string): void;
  setPreviewOpen(open: boolean): void;
  setEditorBottomPanelOpen(open: boolean): void;
  setSidebarCollapsed(collapsed: boolean): void;
  setEditorFilesCollapsed(collapsed: boolean): void;
  toggleMainPanel(panel: MainPanelKey): void;
  setWorkbenchLayout(layout: number[]): void;
  updateCodexCommandSettings(settings: Partial<UiState["codexCommandSettings"]>): void;
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
      workbenchTab: "chat",
      controlTab: "git",
      previewOpen: false,
      editorBottomPanelOpen: false,
      sidebarCollapsed: false,
      editorFilesCollapsed: false,
      collapsedMainPanels: DEFAULT_COLLAPSED_MAIN_PANELS,
      workbenchLayout: DEFAULT_WORKBENCH_LAYOUT,
      codexCommandSettings: {
        statuslineItems: DEFAULT_STATUSLINE_ITEMS,
        useThemeColors: true,
        titleItems: ["project", "thread"],
        experimentalFeatures: {},
        model: "Codex SDK default",
        reasoningEffort: "medium",
        sandbox: "workspace-write",
        approvals: "on-request",
        vimMode: false,
        rawMode: false,
        theme: "light",
      },
      codexCommandSettingOverrides: {},
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
        set((state) => {
          const current = state.codexEvents[sessionId] ?? [];
          const existingIndex = event.sourceItemId ? current.findIndex((item) => item.sourceItemId === event.sourceItemId) : -1;
          const next =
            existingIndex === -1
              ? [...current, event]
              : current.map((item, index) => (index === existingIndex ? { ...item, ...event, id: item.id } : item));
          return {
            codexEvents: {
              ...state.codexEvents,
              [sessionId]: next.slice(-24),
            },
          };
        }),
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
          const shouldUpdateDraft = currentDraft === undefined || currentDraft === previousContent || (previousContent === undefined && currentDraft === "");
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
      setWorkbenchTab: (workbenchTab) => {
        if (get().workbenchTab === workbenchTab) return;
        set({ workbenchTab });
      },
      setControlTab: (controlTab) => {
        if (get().controlTab === controlTab) return;
        set({ controlTab });
      },
      setSelectedPreviewId: (selectedPreviewId) => {
        if (get().selectedPreviewId === selectedPreviewId) return;
        set({ selectedPreviewId });
      },
      setPreviewOpen: (previewOpen) => {
        if (get().previewOpen === previewOpen) return;
        set({ previewOpen });
      },
      setEditorBottomPanelOpen: (editorBottomPanelOpen) => {
        if (get().editorBottomPanelOpen === editorBottomPanelOpen) return;
        set({ editorBottomPanelOpen });
      },
      setSidebarCollapsed: (sidebarCollapsed) => {
        if (get().sidebarCollapsed === sidebarCollapsed) return;
        set({ sidebarCollapsed });
      },
      setEditorFilesCollapsed: (editorFilesCollapsed) => {
        if (get().editorFilesCollapsed === editorFilesCollapsed) return;
        set({ editorFilesCollapsed });
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
      updateCodexCommandSettings: (settings) =>
        set((state) => ({
          codexCommandSettings: {
            ...state.codexCommandSettings,
            ...settings,
            statuslineItems: normalizeStatuslineItems(settings.statuslineItems ?? state.codexCommandSettings.statuslineItems),
          },
          codexCommandSettingOverrides: {
            ...state.codexCommandSettingOverrides,
            ...Object.fromEntries(Object.keys(settings).map((key) => [key, true])),
          },
        })),
    }),
    {
      name: "codex-web-ui",
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        activeSessionId: state.activeSessionId,
        activeFilePath: state.activeFilePath,
        openFilePaths: state.openFilePaths,
        selectedPanel: state.selectedPanel,
        workbenchTab: state.workbenchTab,
        controlTab: state.controlTab,
        selectedPreviewId: state.selectedPreviewId,
        previewOpen: state.previewOpen,
        editorBottomPanelOpen: state.editorBottomPanelOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        editorFilesCollapsed: state.editorFilesCollapsed,
        collapsedMainPanels: normalizeCollapsedMainPanels(state.collapsedMainPanels),
        workbenchLayout: state.workbenchLayout,
        codexCommandSettings: state.codexCommandSettings,
        codexCommandSettingOverrides: state.codexCommandSettingOverrides,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<UiState> | undefined;
        const persistedSettings = persistedState?.codexCommandSettings;
        return {
          ...current,
          ...persistedState,
          codexCommandSettings: {
            ...current.codexCommandSettings,
            ...persistedSettings,
            statuslineItems: normalizeStatuslineItems(persistedSettings?.statuslineItems),
            useThemeColors: persistedSettings?.useThemeColors ?? current.codexCommandSettings.useThemeColors,
          },
          codexCommandSettingOverrides: persistedState?.codexCommandSettingOverrides ?? current.codexCommandSettingOverrides,
          collapsedMainPanels: normalizeCollapsedMainPanels(persistedState?.collapsedMainPanels),
        };
      },
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

export function normalizeWorkbenchTab(value?: string): WorkbenchTab {
  if (value === "control" || value === "usage" || value === "system") return "system";
  return value === "editor" ? value : "chat";
}

export function normalizeControlTab(value?: string): ControlTab {
  if (value === "jobs" || value === "previews" || value === "services" || value === "runtime") return "runtime";
  return value === "usage" ? value : "git";
}
