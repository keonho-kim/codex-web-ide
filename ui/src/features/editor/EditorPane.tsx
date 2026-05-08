import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { api } from "../../lib/api";
import { useUiStore } from "../../store/uiStore";

export function EditorPane({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const activeFilePath = useUiStore((state) => state.activeFilePath);
  const openFilePaths = useUiStore((state) => state.openFilePaths);
  const setActiveFilePath = useUiStore((state) => state.setActiveFilePath);
  const closeFilePath = useUiStore((state) => state.closeFilePath);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const file = useQuery({
    queryKey: ["file", sessionId, activeFilePath],
    queryFn: () => api<{ path: string; content: string }>(`/api/sessions/${sessionId}/files/read?path=${encodeURIComponent(activeFilePath || "")}`),
    enabled: Boolean(sessionId && activeFilePath),
  });
  const draft = activeFilePath ? (drafts[activeFilePath] ?? file.data?.content ?? "") : "";
  const save = useMutation({
    mutationFn: () => api("/api/sessions/" + sessionId + "/files/write", { method: "PUT", body: { path: activeFilePath, content: draft } }),
    onSuccess: async () => {
      if (activeFilePath) setDrafts((items) => ({ ...items, [activeFilePath]: draft }));
      await queryClient.invalidateQueries({ queryKey: ["file", sessionId, activeFilePath] });
    },
  });
  const dirty = Boolean(activeFilePath && file.data && draft !== file.data.content);

  useEffect(() => {
    const content = file.data?.content;
    if (!activeFilePath || content === undefined) return;
    setDrafts((items) => (activeFilePath in items ? items : { ...items, [activeFilePath]: content }));
  }, [activeFilePath, file.data?.content]);

  return (
    <section className="grid h-full min-w-0 grid-rows-[38px_34px_minmax(0,1fr)] overflow-hidden border-r border-hairline bg-canvas">
      <div className="flex min-w-0 items-center justify-between border-b border-hairline px-2 py-1.5">
        <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">{activeFilePath ? `${dirty ? "* " : ""}${activeFilePath}` : "No file open"}</span>
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Save file"
          type="button"
          disabled={!activeFilePath || !dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          <Save size={16} />
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-hairline px-1.5 py-1">
        {openFilePaths.map((path) => (
          <div
            className={`inline-flex h-6 max-w-[200px] shrink-0 items-center overflow-hidden rounded-md border text-xs ${
              path === activeFilePath ? "border-selected-border bg-selected text-primary" : "border-transparent bg-transparent text-ink hover:bg-page"
            }`}
            key={path}
          >
            <button className="min-w-0 flex-1 overflow-hidden px-2 text-left text-ellipsis whitespace-nowrap" type="button" onClick={() => setActiveFilePath(path)}>
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
      {activeFilePath ? (
        <Editor
          height="100%"
          path={activeFilePath}
          value={draft}
          theme="vs-light"
          options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false }}
          onChange={(value) => {
            if (activeFilePath) setDrafts((items) => ({ ...items, [activeFilePath]: value ?? "" }));
          }}
        />
      ) : (
        <div className="flex items-center justify-center text-[13px] text-muted">Open a file from the tree.</div>
      )}
    </section>
  );
}
