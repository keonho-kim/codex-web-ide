import { create } from "zustand";

export type UiState = {
  activeProjectId?: string;
  activeSessionId?: string;
  activeFilePath?: string;
  openFilePaths: string[];
  selectedPanel: "preview" | "git" | "jobs" | "services";
  setActiveProjectId(id?: string): void;
  setActiveSessionId(id?: string): void;
  setActiveFilePath(path?: string): void;
  closeFilePath(path: string): void;
  setSelectedPanel(panel: UiState["selectedPanel"]): void;
};

export const useUiStore = create<UiState>((set) => ({
  openFilePaths: [],
  selectedPanel: "git",
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setActiveFilePath: (activeFilePath) =>
    set((state) => ({
      activeFilePath,
      openFilePaths: activeFilePath && !state.openFilePaths.includes(activeFilePath) ? [...state.openFilePaths, activeFilePath] : state.openFilePaths,
    })),
  closeFilePath: (path) =>
    set((state) => {
      const openFilePaths = state.openFilePaths.filter((item) => item !== path);
      const activeFilePath = state.activeFilePath === path ? openFilePaths.at(-1) : state.activeFilePath;
      return { activeFilePath, openFilePaths };
    }),
  setSelectedPanel: (selectedPanel) => set({ selectedPanel }),
}));
