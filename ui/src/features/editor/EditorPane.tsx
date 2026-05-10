import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Play, Save, Search, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import type { FileTreeNode, PreviewInstance } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";
import { isHtmlPath, isPreviewablePath } from "./documentTypes";
import { EditorTerminalPanel } from "./EditorTerminalPanel";
import { PreviewSuggestionToast } from "./PreviewSuggestionToast";

type EditorMode = "raw" | "preview";
type MonacoEditor = Parameters<OnMount>[0];

const DocumentPreview = lazy(() => import("./DocumentPreview").then((module) => ({ default: module.DocumentPreview })));

loader.config({ monaco });

export function EditorPane({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const editorRef = useRef<MonacoEditor | null>(null);
  const [mode, setMode] = useState<EditorMode>("raw");
  const [activePreviewTabId, setActivePreviewTabId] = useState<string | undefined>();
  const [iframeVersion] = useState(0);
  const [dismissedPreviewKey, setDismissedPreviewKey] = useState<string | undefined>();
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const activeFilePath = useUiStore((state) => state.activeFilePath);
  const editorDrafts = useUiStore((state) => state.editorDrafts);
  const openFilePaths = useUiStore((state) => state.openFilePaths);
  const selectedPreviewId = useUiStore((state) => state.selectedPreviewId);
  const editorBottomPanelOpen = useUiStore((state) => state.editorBottomPanelOpen);
  const setActiveFilePath = useUiStore((state) => state.setActiveFilePath);
  const closeFilePath = useUiStore((state) => state.closeFilePath);
  const setEditorDraft = useUiStore((state) => state.setEditorDraft);
  const hydrateEditorDraft = useUiStore((state) => state.hydrateEditorDraft);
  const setSelectedPreviewId = useUiStore((state) => state.setSelectedPreviewId);
  const setEditorBottomPanelOpen = useUiStore((state) => state.setEditorBottomPanelOpen);

  const file = useQuery({
    queryKey: ["file", sessionId, activeFilePath],
    queryFn: () => api<{ path: string; content: string }>(`/api/sessions/${sessionId}/files/read?path=${encodeURIComponent(activeFilePath || "")}`),
    enabled: Boolean(sessionId && activeFilePath),
  });
  const tree = useQuery({
    queryKey: ["tree", sessionId],
    queryFn: () => api<FileTreeNode[]>(`/api/sessions/${sessionId}/files/tree`),
    enabled: Boolean(sessionId && quickOpen),
  });
  const previews = useQuery({
    queryKey: ["previews", sessionId],
    queryFn: () => api<PreviewInstance[]>(`/api/sessions/${sessionId}/previews`),
    enabled: Boolean(sessionId),
  });
  const draft = activeFilePath ? (editorDrafts[activeFilePath] ?? file.data?.content ?? "") : "";
  const previewable = isPreviewablePath(activeFilePath);
  const previewCommand = useMemo(() => getSuggestedPreviewCommand(activeFilePath, draft), [activeFilePath, draft]);
  const previewKey = previewCommand ? `${activeFilePath ?? "workspace"}:${previewCommand.join(" ")}` : undefined;
  const previewCommandLabel = previewCommand?.join(" ") ?? "";
  const filePaths = useMemo(() => flattenFiles(tree.data ?? []), [tree.data]);
  const quickOpenMatches = useMemo(() => filterFiles(filePaths, quickOpenQuery).slice(0, 30), [filePaths, quickOpenQuery]);
  const activePreview = (previews.data ?? []).find((preview) => preview.id === activePreviewTabId);
  const selectedPreview = (previews.data ?? []).find((preview) => preview.id === selectedPreviewId);
  const previewTabs = selectedPreview ? [selectedPreview] : [];
  const runningPreviewForSuggestion = previewCommand
    ? (previews.data ?? []).some((preview) => preview.status === "running" && sameCommand(preview.command, previewCommand))
    : false;
  const dirty = Boolean(activeFilePath && file.data && draft !== file.data.content);

  const save = useMutation({
    mutationFn: () => api("/api/sessions/" + sessionId + "/files/write", { method: "PUT", body: { path: activeFilePath, content: draft } }),
    onSuccess: async () => {
      if (activeFilePath) setEditorDraft(activeFilePath, draft);
      await queryClient.invalidateQueries({ queryKey: ["file", sessionId, activeFilePath] });
    },
  });
  const startPreview = useMutation({
    mutationFn: (command: string[]) =>
      api<PreviewInstance>(`/api/sessions/${sessionId}/previews`, {
        method: "POST",
        body: { command, approvedDangerous: requiresDangerousApproval(command) },
      }),
    onSuccess: async (preview) => {
      setSelectedPreviewId(preview.id);
      setActivePreviewTabId(preview.id);
      await queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    },
  });

  useEffect(() => {
    const content = file.data?.content;
    if (!activeFilePath || content === undefined) return;
    hydrateEditorDraft(activeFilePath, content);
  }, [activeFilePath, file.data?.content, hydrateEditorDraft]);

  useEffect(() => {
    setMode("raw");
    setActivePreviewTabId(undefined);
  }, [activeFilePath]);

  useEffect(() => {
    if (selectedPreviewId && previews.data?.some((preview) => preview.id === selectedPreviewId)) setActivePreviewTabId(selectedPreviewId);
  }, [previews.data, selectedPreviewId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) {
        if (event.key === "Escape" && quickOpen) {
          event.preventDefault();
          setQuickOpen(false);
        }
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "`") {
        event.preventDefault();
        setEditorBottomPanelOpen(!editorBottomPanelOpen);
        return;
      }
      if (key === "s") {
        event.preventDefault();
        if (dirty && !save.isPending) save.mutate();
        return;
      }
      if (key === "p") {
        event.preventDefault();
        setQuickOpen(true);
        setQuickOpenQuery("");
        return;
      }
      if (key === "l" && activeFilePath) {
        event.preventDefault();
        editorRef.current?.focus();
        editorRef.current?.trigger("keyboard", "expandLineSelection", null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeFilePath, dirty, editorBottomPanelOpen, quickOpen, save, setEditorBottomPanelOpen]);

  const runPreview = (command: string[]) => {
    if (!sessionId || command.length === 0 || !confirmDangerousCommand(command)) return;
    startPreview.mutate(command);
  };
  const previewSuggestionVisible = Boolean(previewCommand && previewKey && dismissedPreviewKey !== previewKey && !runningPreviewForSuggestion);

  return (
    <section
      className={cn(
        "relative grid h-full min-w-0 overflow-hidden bg-canvas",
        editorBottomPanelOpen ? "grid-rows-[48px_40px_minmax(0,1fr)_auto]" : "grid-rows-[48px_40px_minmax(0,1fr)]",
      )}
    >
      <div className="flex h-12 min-w-0 items-center justify-between border-b border-hairline bg-panel px-4">
        <span className="truncate font-mono text-xs text-muted">
          {activePreview ? `Preview: ${activePreview.publicUrl}` : activeFilePath ? `${dirty ? "* " : ""}${activeFilePath}` : "No file open"}
        </span>
        <div className="flex items-center gap-1">
          {previewable && !activePreview ? (
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-control bg-canvas">
              <button
                className={cn("inline-flex items-center gap-1 px-2 text-xs", mode === "raw" ? "bg-selected text-primary" : "text-muted hover:bg-page")}
                type="button"
                onClick={() => setMode("raw")}
              >
                <FileText size={13} />
                Raw
              </button>
              <button
                className={cn("inline-flex items-center gap-1 border-l border-control px-2 text-xs", mode === "preview" ? "bg-selected text-primary" : "text-muted hover:bg-page")}
                type="button"
                onClick={() => setMode("preview")}
              >
                <Eye size={13} />
                Preview
              </button>
            </div>
          ) : null}
          <Button title="Open terminal" type="button" variant="outline" size="icon-sm" onClick={() => setEditorBottomPanelOpen(!editorBottomPanelOpen)}>
            <Terminal data-icon="inline-start" />
          </Button>
          <Button title="Quick open" type="button" variant="outline" size="icon-sm" onClick={() => setQuickOpen(true)}>
            <Search data-icon="inline-start" />
          </Button>
          {previewCommand ? (
            <Button type="button" variant="outline" size="sm" disabled={startPreview.isPending} onClick={() => runPreview(previewCommand)}>
              <Play data-icon="inline-start" />
              Run Preview Server
            </Button>
          ) : null}
          <Button title="Save file" type="button" disabled={!activeFilePath || Boolean(activePreview) || !dirty || save.isPending} onClick={() => save.mutate()} variant="outline" size="icon-sm">
            <Save data-icon="inline-start" />
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-hairline px-3 py-1.5">
        {openFilePaths.map((path) => (
          <div
            className={cn(
              "inline-flex h-7 max-w-[220px] shrink-0 items-center overflow-hidden rounded-md border text-xs",
              !activePreview && path === activeFilePath ? "border-selected-border bg-selected text-primary" : "border-transparent bg-transparent text-ink hover:bg-page",
            )}
            key={path}
          >
            <button
              className="min-w-0 flex-1 truncate px-2 text-left"
              type="button"
              onClick={() => {
                setActivePreviewTabId(undefined);
                setActiveFilePath(path);
              }}
            >
              {path}
            </button>
            <button className="inline-flex h-full items-center px-1" title="Close tab" type="button" onClick={() => closeFilePath(path)}>
              <X size={12} />
            </button>
          </div>
        ))}
        {previewTabs.map((preview) => (
          <div
            className={cn(
              "inline-flex h-7 max-w-[220px] shrink-0 items-center overflow-hidden rounded-md border text-xs",
              activePreview?.id === preview.id ? "border-selected-border bg-selected text-primary" : "border-transparent bg-transparent text-ink hover:bg-page",
            )}
            key={preview.id}
          >
            <button className="min-w-0 flex-1 truncate px-2 text-left" type="button" onClick={() => setActivePreviewTabId(preview.id)}>
              Preview
            </button>
            <button className="inline-flex h-full items-center px-1" title="Close preview tab" type="button" onClick={() => setActivePreviewTabId(undefined)}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="relative min-h-0 overflow-hidden">
        {activePreview ? (
          <iframe key={`${activePreview.id}:${iframeVersion}`} className="h-full w-full border-0 bg-white" title="Preview" src={activePreview.publicUrl} sandbox="allow-forms allow-modals allow-popups allow-presentation allow-scripts" />
        ) : activeFilePath && previewable && mode === "preview" ? (
          <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted">Rendering preview.</div>}>
            <DocumentPreview content={draft} path={activeFilePath} />
          </Suspense>
        ) : activeFilePath ? (
          <Editor
            height="100%"
            path={activeFilePath}
            value={draft}
            theme="vs-light"
            options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on", scrollBeyondLastLine: false, padding: { top: 18, bottom: 18 } }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            onChange={(value) => {
              if (activeFilePath) setEditorDraft(activeFilePath, value ?? "");
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-muted">Open a file from the tree.</div>
        )}
        {previewSuggestionVisible && previewCommand ? (
          <PreviewSuggestionToast
            commandLabel={previewCommandLabel}
            disabled={startPreview.isPending}
            onDismiss={() => setDismissedPreviewKey(previewKey)}
            onNo={() => setDismissedPreviewKey(previewKey)}
            onYes={() => runPreview(previewCommand)}
          />
        ) : null}
        {quickOpen ? (
          <QuickOpen
            matches={quickOpenMatches}
            query={quickOpenQuery}
            onClose={() => setQuickOpen(false)}
            onOpen={(path) => {
              setActiveFilePath(path);
              setQuickOpen(false);
            }}
            onQueryChange={setQuickOpenQuery}
          />
        ) : null}
      </div>
      {editorBottomPanelOpen ? (
        <EditorTerminalPanel
          onClose={() => setEditorBottomPanelOpen(false)}
          sessionId={sessionId}
        />
      ) : null}
    </section>
  );
}

function QuickOpen({
  matches,
  onClose,
  onOpen,
  onQueryChange,
  query,
}: {
  matches: string[];
  onClose(): void;
  onOpen(path: string): void;
  onQueryChange(query: string): void;
  query: string;
}) {
  return (
    <div className="absolute inset-0 z-30 bg-canvas/70 p-6 backdrop-blur-[1px]">
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-hairline bg-panel shadow-sm">
        <input
          autoFocus
          className="h-11 w-full border-b border-hairline bg-canvas px-4 text-sm outline-none"
          placeholder="Quick open file"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Enter" && matches[0]) onOpen(matches[0]);
          }}
        />
        <div className="max-h-80 overflow-auto p-2">
          {matches.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">No files found.</p>
          ) : (
            matches.map((path) => (
              <button
                className="block w-full rounded-md px-2 py-2 text-left font-mono text-xs text-ink hover:bg-page"
                key={path}
                type="button"
                onClick={() => onOpen(path)}
              >
                {path}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getSuggestedPreviewCommand(path: string | undefined, content: string) {
  if (!path) return undefined;
  if (isHtmlPath(path)) return htmlPreviewCommand(path);
  if (!/(^|\/)package\.json$/i.test(path)) return undefined;
  try {
    const parsed = JSON.parse(content) as { scripts?: Record<string, unknown> };
    if (typeof parsed.scripts?.dev !== "string") return undefined;
  } catch {
    return ["bun", "run", "dev"];
  }
  return ["bun", "run", "dev"];
}

function htmlPreviewCommand(path: string) {
  const script = [
    `const path = require("node:path");`,
    `const root = process.cwd();`,
    `const target = ${JSON.stringify(path)};`,
    `const port = Number(process.env.PORT || 3000);`,
    `Bun.serve({`,
    `  hostname: "127.0.0.1",`,
    `  port,`,
    `  async fetch(req) {`,
    `    const url = new URL(req.url);`,
    `    const rel = decodeURIComponent(url.pathname.slice(1)) || target;`,
    `    const full = path.resolve(root, rel);`,
    `    if (full !== root && !full.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });`,
    `    return new Response(Bun.file(full));`,
    `  },`,
    `});`,
    `console.log("HTML preview listening on", port);`,
  ].join("\n");
  return ["bun", "--eval", script];
}

function flattenFiles(nodes: FileTreeNode[]) {
  const files: string[] = [];
  const visit = (node: FileTreeNode) => {
    if (!node.isDirectory) files.push(node.path);
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of nodes) visit(node);
  return files;
}

function filterFiles(files: string[], query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return files;
  return files.filter((path) => path.toLowerCase().includes(value));
}

function sameCommand(left: string[], right: string[]) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}
