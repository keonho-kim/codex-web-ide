import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { GitFileStatus, GitState } from "../../lib/types";

export function useGitPanel(sessionId?: string) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<string>();
  const [commitMessage, setCommitMessage] = useState("");
  const [branchName, setBranchName] = useState("");

  const state = useQuery({
    queryKey: ["git", sessionId, "state"],
    queryFn: () => api<GitState>(`/api/sessions/${sessionId}/git/state`),
    enabled: Boolean(sessionId),
    refetchInterval: 3000,
  });
  const status = useQuery({
    queryKey: ["git", sessionId, "status"],
    queryFn: () => api<GitFileStatus[]>(`/api/sessions/${sessionId}/git/status`),
    enabled: Boolean(sessionId),
  });
  const branches = useQuery({
    queryKey: ["git", sessionId, "branches"],
    queryFn: () => api<string[]>(`/api/sessions/${sessionId}/git/branch`, { method: "POST" }),
    enabled: Boolean(sessionId),
  });
  const diff = useQuery({
    queryKey: ["git", sessionId, "diff", selectedFile],
    queryFn: () => api<{ diff: string }>(`/api/sessions/${sessionId}/git/diff?path=${encodeURIComponent(selectedFile || "")}`),
    enabled: Boolean(sessionId && selectedFile),
  });

  const refreshGit = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["git", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["git", sessionId, "branches"] }),
    ]);
  };
  const stage = useMutation({
    mutationFn: (pathName: string) => api(`/api/sessions/${sessionId}/git/stage`, { method: "POST", body: { files: [pathName] } }),
    onSuccess: refreshGit,
  });
  const unstage = useMutation({
    mutationFn: (pathName: string) => api(`/api/sessions/${sessionId}/git/unstage`, { method: "POST", body: { files: [pathName] } }),
    onSuccess: refreshGit,
  });
  const commit = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/git/commit`, { method: "POST", body: { message: commitMessage } }),
    onSuccess: async () => {
      setCommitMessage("");
      await refreshGit();
    },
  });
  const pull = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/git/pull`, { method: "POST" }),
    onSuccess: refreshGit,
  });
  const push = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/git/push`, { method: "POST" }),
    onSuccess: refreshGit,
  });
  const checkout = useMutation({
    mutationFn: (branch: string) => api(`/api/sessions/${sessionId}/git/checkout`, { method: "POST", body: { branch } }),
    onSuccess: refreshGit,
  });
  const createBranch = useMutation({
    mutationFn: () => api(`/api/sessions/${sessionId}/git/create-and-checkout`, { method: "POST", body: { branch: branchName } }),
    onSuccess: async () => {
      setBranchName("");
      await refreshGit();
    },
  });

  return {
    branchName,
    branches: branches.data ?? [],
    commitMessage,
    diff: diff.data?.diff,
    selectedFile,
    state: state.data,
    status: status.data ?? [],
    setBranchName,
    setCommitMessage,
    setSelectedFile,
    actions: {
      checkout: (branch: string) => checkout.mutate(branch),
      commit: () => commit.mutate(),
      createBranch: () => createBranch.mutate(),
      pull: () => pull.mutate(),
      push: () => push.mutate(),
      stage: (pathName: string) => stage.mutate(pathName),
      unstage: (pathName: string) => unstage.mutate(pathName),
      pending: {
        commit: commit.isPending,
        createBranch: createBranch.isPending,
        pull: pull.isPending,
        push: push.isPending,
      },
    },
  };
}
