import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiState = {
  activeProjectId?: string;
  activeSessionId?: string;
  activeFilePath?: string;
  editorDrafts: Record<string, string>;
  openFilePaths: string[];
  selectedPanel: "preview" | "git" | "jobs" | "services";
  selectedPreviewId?: string;
  sidebarCollapsed: boolean;
  workbenchLayout: number[];
  setActiveProjectId(id?: string): void;
  setActiveSessionId(id?: string): void;
  setActiveFilePath(path?: string): void;
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
      editorDrafts: {},
      selectedPanel: "git",
      sidebarCollapsed: false,
      workbenchLayout: [18, 52, 30],
      setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
      setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
      setActiveFilePath: (activeFilePath) =>
        set((state) => ({
          activeFilePath,
          openFilePaths: activeFilePath && !state.openFilePaths.includes(activeFilePath) ? [...state.openFilePaths, activeFilePath] : state.openFilePaths,
        })),
      setEditorDraft: (path, content) =>
        set((state) => ({
          editorDrafts: { ...state.editorDrafts, [path]: content },
        })),
      hydrateEditorDraft: (path, content) =>
        set((state) => (path in state.editorDrafts ? state : { editorDrafts: { ...state.editorDrafts, [path]: content } })),
      discardEditorDraft: (path) =>
        set((state) => {
          const { [path]: _discarded, ...editorDrafts } = state.editorDrafts;
          return { editorDrafts };
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
