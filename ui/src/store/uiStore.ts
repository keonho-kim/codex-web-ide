import { create } from "zustand";

export type UiState = {
  activeProjectId?: string;
  activeSessionId?: string;
  activeFilePath?: string;
  selectedPanel: "preview" | "git" | "jobs" | "services";
  setActiveProjectId(id?: string): void;
  setActiveSessionId(id?: string): void;
  setActiveFilePath(path?: string): void;
  setSelectedPanel(panel: UiState["selectedPanel"]): void;
};

export const useUiStore = create<UiState>((set) => ({
  selectedPanel: "git",
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setActiveFilePath: (activeFilePath) => set({ activeFilePath }),
  setSelectedPanel: (selectedPanel) => set({ selectedPanel }),
}));
