import type { OnMount } from "@monaco-editor/react";

type MonacoEditor = Parameters<OnMount>[0];
type MonacoInstance = Parameters<OnMount>[1];

export function registerEditorActions(editor: MonacoEditor, monacoInstance: MonacoInstance, toggleTerminal: () => void) {
  editor.addAction({
    id: "codex-web.toggle-terminal",
    label: "Toggle Terminal",
    keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyJ],
    contextMenuGroupId: "navigation",
    contextMenuOrder: 1,
    run: () => toggleTerminal(),
  });
  editor.addAction({
    id: "codex-web.select-all-occurrences",
    label: "Select All Occurrences",
    keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyL],
    contextMenuGroupId: "9_selection",
    contextMenuOrder: 1,
    run: (target) => target.trigger("contextmenu", "editor.action.selectHighlights", null),
  });
}
