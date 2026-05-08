import { useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import { useUiStore } from "../../store/uiStore";

export function EditorPane({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
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

  return (
    <section className="workspace-pane grid-rows-[38px_34px_minmax(0,1fr)]">
      <div className="pane-toolbar">
        <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">{activeFilePath ? `${dirty ? "* " : ""}${activeFilePath}` : "No file open"}</span>
        <Button title="Save file" type="button" disabled={!activeFilePath || !dirty || save.isPending} onClick={() => save.mutate()} variant="outline" size="icon-sm">
          <Save data-icon="inline-start" />
        </Button>
      </div>
      <div className="editor-tabs">
        {openFilePaths.map((path) => (
          <div
            className={cn("editor-tab", path === activeFilePath ? "panel-tab-selected" : "editor-tab-idle")}
            key={path}
          >
            <button className="editor-tab-file" type="button" onClick={() => setActiveFilePath(path)}>
              {path}
            </button>
            <button
              className="editor-tab-close"
              title="Close tab"
              type="button"
              onClick={() => closeFilePath(path)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      {activeFilePath ? (
        <Editor
          height="100%"
          path={activeFilePath}
          value={draft}
          theme="vs-light"
          options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false }}
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
