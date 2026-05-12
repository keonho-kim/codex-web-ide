import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUiStore } from "@/store/uiStore";

export function useFileActions(sessionId?: string) {
  const queryClient = useQueryClient();
  const activeFilePath = useUiStore((state) => state.activeFilePath);
  const setActiveFilePath = useUiStore((state) => state.setActiveFilePath);
  const closeFilePath = useUiStore((state) => state.closeFilePath);
  const discardEditorDraft = useUiStore((state) => state.discardEditorDraft);
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
      if (activeFilePath) discardEditorDraft(activeFilePath);
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
      if (operationPath) discardEditorDraft(operationPath);
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

  return {
    activeFilePath,
    error,
    operationPath,
    pathInput,
    pending,
    trimmedPath,
    setPathInput,
    actions: {
      createDirectory: () => createDirectory.mutate(),
      createFile: () => createFile.mutate(),
      deleteFile: () => deleteFile.mutate(),
      renameFile: () => renameFile.mutate(),
    },
  };
}
