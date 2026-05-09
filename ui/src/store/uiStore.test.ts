import { expect, test } from "bun:test";
import { normalizeCollapsedMainPanels, selectCodexEvents, useUiStore } from "./uiStore";

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
  state.setSelectedPreviewId(state.selectedPreviewId);
  state.setSidebarCollapsed(state.sidebarCollapsed);
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
