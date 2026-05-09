import { lazy, Suspense, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import { useUiStore } from "../../store/uiStore";
import { isPreviewablePath } from "./documentTypes";

type EditorMode = "raw" | "preview";
const DocumentPreview = lazy(() => import("./DocumentPreview").then((module) => ({ default: module.DocumentPreview })));

export function EditorPane({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<EditorMode>("raw");
  const activeFilePath = useUiStore((state) => state.activeFilePath);
  const editorDrafts = useUiStore((state) => state.editorDrafts);
  const openFilePaths = useUiStore((state) => state.openFilePaths);
  const setActiveFilePath = useUiStore((state) => state.setActiveFilePath);
  const closeFilePath = useUiStore((state) => state.closeFilePath);
  const setEditorDraft = useUiStore((state) => state.setEditorDraft);
  const hydrateEditorDraft = useUiStore((state) => state.hydrateEditorDraft);
  const file = useQuery({
    queryKey: ["file", sessionId, activeFilePath],
    queryFn: () => api<{ path: string; content: string }>(`/api/sessions/${sessionId}/files/read?path=${encodeURIComponent(activeFilePath || "")}`),
    enabled: Boolean(sessionId && activeFilePath),
  });
  const draft = activeFilePath ? (editorDrafts[activeFilePath] ?? file.data?.content ?? "") : "";
  const previewable = isPreviewablePath(activeFilePath);
  const save = useMutation({
    mutationFn: () => api("/api/sessions/" + sessionId + "/files/write", { method: "PUT", body: { path: activeFilePath, content: draft } }),
    onSuccess: async () => {
      if (activeFilePath) setEditorDraft(activeFilePath, draft);
      await queryClient.invalidateQueries({ queryKey: ["file", sessionId, activeFilePath] });
    },
  });
  const dirty = Boolean(activeFilePath && file.data && draft !== file.data.content);

  useEffect(() => {
    const content = file.data?.content;
    if (!activeFilePath || content === undefined) return;
    hydrateEditorDraft(activeFilePath, content);
  }, [activeFilePath, file.data?.content, hydrateEditorDraft]);

  useEffect(() => {
    setMode("raw");
  }, [activeFilePath]);

  return (
    <section className="grid h-full min-w-0 grid-rows-[48px_40px_minmax(0,1fr)] overflow-hidden bg-canvas">
      <div className="flex min-w-0 items-center justify-between border-b border-hairline bg-panel px-4 py-2">
        <span className="truncate font-mono text-xs text-muted">{activeFilePath ? `${dirty ? "* " : ""}${activeFilePath}` : "No file open"}</span>
        <div className="flex items-center gap-1">
          {previewable ? (
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
          <Button title="Save file" type="button" disabled={!activeFilePath || !dirty || save.isPending} onClick={() => save.mutate()} variant="outline" size="icon-sm">
            <Save data-icon="inline-start" />
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-hairline px-3 py-1.5">
        {openFilePaths.map((path) => (
          <div
            className={cn(
              "inline-flex h-7 max-w-[220px] shrink-0 items-center overflow-hidden rounded-md border text-xs",
              path === activeFilePath ? "border-selected-border bg-selected text-primary" : "border-transparent bg-transparent text-ink hover:bg-page",
            )}
            key={path}
          >
            <button className="min-w-0 flex-1 truncate px-2 text-left" type="button" onClick={() => setActiveFilePath(path)}>
              {path}
            </button>
            <button
              className="inline-flex h-full items-center px-1"
              title="Close tab"
              type="button"
              onClick={() => closeFilePath(path)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      {activeFilePath && previewable && mode === "preview" ? (
        <Suspense fallback={<div className="flex items-center justify-center text-xs text-muted">Rendering preview.</div>}>
          <DocumentPreview content={draft} path={activeFilePath} />
        </Suspense>
      ) : activeFilePath ? (
        <Editor
          height="100%"
          path={activeFilePath}
          value={draft}
          theme="vs-light"
          options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: "on", scrollBeyondLastLine: false, padding: { top: 18, bottom: 18 } }}
          onChange={(value) => {
            if (activeFilePath) setEditorDraft(activeFilePath, value ?? "");
          }}
        />
      ) : (
        <div className="flex items-center justify-center text-[13px] text-muted">Open a file from the tree.</div>
      )}
    </section>
  );
}
