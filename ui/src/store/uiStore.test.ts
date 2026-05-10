import { expect, test } from "bun:test";
import { normalizeCollapsedMainPanels, normalizeControlTab, normalizeWorkbenchTab, selectCodexEvents, useUiStore } from "./uiStore";

test("returns stable empty Codex event snapshots", () => {
  const state = useUiStore.getState();

  expect(selectCodexEvents(state)).toBe(selectCodexEvents(state));
  expect(selectCodexEvents(state, "missing-session")).toBe(selectCodexEvents(state, "missing-session"));
});

test("updates existing Codex item event snapshots", () => {
  const state = useUiStore.getState();
  state.clearCodexEvents("session-a");

  state.appendCodexEvent("session-a", {
    id: "event-started",
    kind: "command",
    label: "item.started",
    sourceItemId: "cmd-1",
    title: "bun test",
    status: "in_progress",
    timestamp: 100,
  });
  state.appendCodexEvent("session-a", {
    id: "event-completed",
    kind: "command",
    label: "item.completed",
    sourceItemId: "cmd-1",
    title: "bun test",
    status: "completed",
    body: "ok",
    timestamp: 200,
  });

  expect(selectCodexEvents(useUiStore.getState(), "session-a")).toEqual([
    expect.objectContaining({
      id: "event-started",
      label: "item.completed",
      sourceItemId: "cmd-1",
      status: "completed",
      body: "ok",
      timestamp: 200,
    }),
  ]);
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

test("hydrates an empty pre-load editor draft with loaded file content", () => {
  const path = "src/app.ts";
  const state = useUiStore.getState();
  state.discardEditorDraft(path);

  state.setEditorDraft(path, "");
  state.hydrateEditorDraft(path, "export const value = 1;\n");

  expect(useUiStore.getState().editorDrafts[path]).toBe("export const value = 1;\n");
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
