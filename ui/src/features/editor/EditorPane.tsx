import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { iconButtonClass } from "../../components/uiClasses";
import { api } from "../../lib/api";
import { useUiStore } from "../../store/uiStore";

export function EditorPane({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const activeFilePath = useUiStore((state) => state.activeFilePath);
  const [draft, setDraft] = useState("");
  const file = useQuery({
    queryKey: ["file", sessionId, activeFilePath],
    queryFn: () => api<{ path: string; content: string }>(`/api/sessions/${sessionId}/files/read?path=${encodeURIComponent(activeFilePath || "")}`),
    enabled: Boolean(sessionId && activeFilePath),
  });
  const save = useMutation({
    mutationFn: () => api("/api/sessions/" + sessionId + "/files/write", { method: "PUT", body: { path: activeFilePath, content: draft } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["file", sessionId, activeFilePath] });
    },
  });

  useEffect(() => {
    setDraft(file.data?.content ?? "");
  }, [file.data?.content]);

  return (
    <section className="grid h-full min-w-0 grid-rows-[38px_minmax(0,1fr)] overflow-hidden border-r border-hairline bg-canvas">
      <div className="flex min-w-0 items-center justify-between border-b border-hairline px-2 py-1.5">
        <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">{activeFilePath || "No file open"}</span>
        <button className={iconButtonClass} title="Save file" type="button" disabled={!activeFilePath || save.isPending} onClick={() => save.mutate()}>
          <Save size={16} />
        </button>
      </div>
      {activeFilePath ? (
        <Editor
          height="100%"
          path={activeFilePath}
          value={draft}
          theme="vs-light"
          options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false }}
          onChange={(value) => setDraft(value ?? "")}
        />
      ) : (
        <div className="flex items-center justify-center text-[13px] text-muted">Open a file from the tree.</div>
      )}
    </section>
  );
}
