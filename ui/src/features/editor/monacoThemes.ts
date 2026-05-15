import type { editor } from "monaco-editor";
import type { ResolvedCodexTheme } from "@/features/app/useCodexTheme";

export type CodexMonacoTheme = `codex-${ResolvedCodexTheme}`;
type MonacoThemeApi = {
  editor: {
    defineTheme(name: string, themeData: editor.IStandaloneThemeData): void;
  };
};

let registered = false;

export function registerCodexMonacoThemes(monacoInstance: MonacoThemeApi) {
  if (registered) return;
  Object.entries(monacoThemes).forEach(([name, theme]) => {
    monacoInstance.editor.defineTheme(name, theme);
  });
  registered = true;
}

export function monacoThemeForCodexTheme(theme: ResolvedCodexTheme): CodexMonacoTheme {
  return `codex-${theme}`;
}

const monacoThemes: Record<CodexMonacoTheme, editor.IStandaloneThemeData> = {
  "codex-light": {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "687174" },
      { token: "keyword", foreground: "466a76" },
      { token: "string", foreground: "4f7464" },
      { token: "number", foreground: "7b6a42" },
      { token: "type", foreground: "626b85" },
    ],
    colors: {
      "editor.background": "#f7f8f7",
      "editor.foreground": "#202627",
      "editorLineNumber.foreground": "#687174",
      "editorLineNumber.activeForeground": "#466a76",
      "editorCursor.foreground": "#466a76",
      "editor.selectionBackground": "#dce8eb",
      "editor.inactiveSelectionBackground": "#e5eaeb",
      "editor.lineHighlightBackground": "#f1f3f2",
      "editorGutter.background": "#f7f8f7",
      "editorIndentGuide.background1": "#d6dcdd",
      "editorIndentGuide.activeBackground1": "#91aab1",
      "editorWidget.background": "#f1f3f2",
      "editorWidget.border": "#d6dcdd",
    },
  },
  "codex-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "9aa7aa" },
      { token: "keyword", foreground: "8fb7c0" },
      { token: "string", foreground: "9ac4ae" },
      { token: "number", foreground: "d0b878" },
      { token: "type", foreground: "b7bdd5" },
    ],
    colors: {
      "editor.background": "#171c1d",
      "editor.foreground": "#e3e9e9",
      "editorLineNumber.foreground": "#9aa7aa",
      "editorLineNumber.activeForeground": "#8fb7c0",
      "editorCursor.foreground": "#8fb7c0",
      "editor.selectionBackground": "#243840",
      "editor.inactiveSelectionBackground": "#263033",
      "editor.lineHighlightBackground": "#202627",
      "editorGutter.background": "#171c1d",
      "editorIndentGuide.background1": "#30393b",
      "editorIndentGuide.activeBackground1": "#6f939c",
      "editorWidget.background": "#202627",
      "editorWidget.border": "#30393b",
    },
  },
  "codex-github": {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "57606a" },
      { token: "keyword", foreground: "0969da" },
      { token: "string", foreground: "1a7f37" },
      { token: "number", foreground: "9a6700" },
      { token: "type", foreground: "8250df" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292f",
      "editorLineNumber.foreground": "#57606a",
      "editorLineNumber.activeForeground": "#0969da",
      "editorCursor.foreground": "#0969da",
      "editor.selectionBackground": "#ddf4ff",
      "editor.inactiveSelectionBackground": "#eaeef2",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editorGutter.background": "#ffffff",
      "editorIndentGuide.background1": "#d0d7de",
      "editorIndentGuide.activeBackground1": "#54aeef",
      "editorWidget.background": "#f6f8fa",
      "editorWidget.border": "#d0d7de",
    },
  },
  "codex-solarized": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "93a1a1" },
      { token: "keyword", foreground: "2aa198" },
      { token: "string", foreground: "859900" },
      { token: "number", foreground: "b58900" },
      { token: "type", foreground: "6c71c4" },
    ],
    colors: {
      "editor.background": "#073642",
      "editor.foreground": "#eee8d5",
      "editorLineNumber.foreground": "#93a1a1",
      "editorLineNumber.activeForeground": "#2aa198",
      "editorCursor.foreground": "#2aa198",
      "editor.selectionBackground": "#123f4b",
      "editor.inactiveSelectionBackground": "#13434f",
      "editor.lineHighlightBackground": "#0b3a46",
      "editorGutter.background": "#073642",
      "editorIndentGuide.background1": "#164b58",
      "editorIndentGuide.activeBackground1": "#2aa198",
      "editorWidget.background": "#0b3a46",
      "editorWidget.border": "#164b58",
    },
  },
};
