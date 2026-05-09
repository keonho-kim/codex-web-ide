import { expect, test } from "bun:test";
import { normalizeCollapsedMainPanels, normalizeControlTab, normalizeWorkbenchTab, selectCodexEvents, useUiStore } from "./uiStore";

test("returns stable empty Codex event snapshots", () => {
  const state = useUiStore.getState();

  expect(selectCodexEvents(state)).toBe(selectCodexEvents(state));
  expect(selectCodexEvents(state, "missing-session")).toBe(selectCodexEvents(state, "missing-session"));
});

test("does not notify subscribers for unchanged UI store values", () => {
  const state = useUiStore.getState();
  let notifications = 0;
  const unsubscribe = useUiStore.subscribe(() => {
    notifications += 1;
  });

  state.setActiveProjectId(state.activeProjectId);
  state.setActiveSessionId(state.activeSessionId);
  state.setSelectedPanel(state.selectedPanel);
  state.setWorkbenchTab(state.workbenchTab);
  state.setControlTab(state.controlTab);
  state.setSelectedPreviewId(state.selectedPreviewId);
  state.setPreviewOpen(state.previewOpen);
  state.setEditorBottomPanelOpen(state.editorBottomPanelOpen);
  state.setSidebarCollapsed(state.sidebarCollapsed);
  state.setEditorFilesCollapsed(state.editorFilesCollapsed);
  state.setWorkbenchLayout([...state.workbenchLayout]);

  unsubscribe();
  expect(notifications).toBe(0);
});

test("normalizes collapsed main panel state", () => {
  expect(normalizeCollapsedMainPanels({ editor: true })).toEqual({
    files: false,
    editor: true,
    codex: false,
    bottom: false,
  });
});

test("normalizes persisted workspace tab state", () => {
  expect(normalizeWorkbenchTab("editor")).toBe("editor");
  expect(normalizeWorkbenchTab("preview")).toBe("chat");
  expect(normalizeControlTab("previews")).toBe("previews");
  expect(normalizeControlTab("services")).toBe("services");
  expect(normalizeControlTab("preview")).toBe("git");
});
