import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useUiStore } from "../../store/uiStore";

export function FileActions({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const activeFilePath = useUiStore((state) => state.activeFilePath);
  const setActiveFilePath = useUiStore((state) => state.setActiveFilePath);
  const closeFilePath = useUiStore((state) => state.closeFilePath);
  const [pathInput, setPathInput] = useState("");
  const trimmedPath = pathInput.trim();
  const operationPath = trimmedPath || activeFilePath;

  useEffect(() => {
    if (activeFilePath) setPathInput(activeFilePath);
  }, [activeFilePath]);

  const refreshFiles = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tree", sessionId] });
  };

  const createFile = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/files/create`, { method: "POST", body: { path: trimmedPath, isDirectory: false } }),
    onSuccess: async () => {
      setActiveFilePath(trimmedPath);
      await refreshFiles();
    },
  });

  const createDirectory = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/files/create`, { method: "POST", body: { path: trimmedPath, isDirectory: true } }),
    onSuccess: refreshFiles,
  });

  const renameFile = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/files/rename`, { method: "POST", body: { from: activeFilePath, to: trimmedPath } }),
    onSuccess: async () => {
      if (activeFilePath) closeFilePath(activeFilePath);
      setActiveFilePath(trimmedPath);
      await Promise.all([
        refreshFiles(),
        queryClient.invalidateQueries({ queryKey: ["file", sessionId, activeFilePath] }),
        queryClient.invalidateQueries({ queryKey: ["file", sessionId, trimmedPath] }),
      ]);
    },
  });

  const deleteFile = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/files/delete`, { method: "POST", body: { path: operationPath } }),
    onSuccess: async () => {
      if (operationPath) closeFilePath(operationPath);
      if (!operationPath || operationPath === activeFilePath) setActiveFilePath(undefined);
      setPathInput("");
      await Promise.all([refreshFiles(), queryClient.invalidateQueries({ queryKey: ["file", sessionId, activeFilePath] })]);
    },
  });

  const pending = createFile.isPending || createDirectory.isPending || renameFile.isPending || deleteFile.isPending;
  const error = useMemo(
    () => createFile.error || createDirectory.error || renameFile.error || deleteFile.error,
    [createDirectory.error, createFile.error, deleteFile.error, renameFile.error],
  );

  return (
    <form
      className="grid gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (sessionId && trimmedPath) createFile.mutate();
      }}
    >
      <div className="flex min-w-0 items-center gap-1">
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2.5 py-1 text-xs text-ink"
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          placeholder="path/to/file.ts"
        />
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Create file"
          type="submit"
          disabled={!sessionId || !trimmedPath || pending}
        >
          <FilePlus2 size={14} />
        </button>
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Create folder"
          type="button"
          disabled={!sessionId || !trimmedPath || pending}
          onClick={() => createDirectory.mutate()}
        >
          <FolderPlus size={14} />
        </button>
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Rename selected file"
          type="button"
          disabled={!sessionId || !activeFilePath || !trimmedPath || activeFilePath === trimmedPath || pending}
          onClick={() => renameFile.mutate()}
        >
          <Pencil size={14} />
        </button>
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Delete path"
          type="button"
          disabled={!sessionId || !operationPath || pending}
          onClick={() => {
            if (operationPath && confirm(`Delete ${operationPath}?`)) deleteFile.mutate();
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {error ? <p className="m-0 text-xs text-red-600">{error instanceof Error ? error.message : "File operation failed."}</p> : null}
    </form>
  );
}
