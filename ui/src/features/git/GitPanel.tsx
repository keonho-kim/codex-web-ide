import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { html as diffToHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import { buttonClass, inputClass, mutedClass, panelContentClass } from "../../components/uiClasses";
import { api } from "../../lib/api";
import type { GitFileStatus, GitState } from "../../lib/types";

export function GitPanel({ sessionId }: { sessionId?: string }) {
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

  return (
    <div className={`${panelContentClass} grid grid-cols-[240px_minmax(0,1fr)] gap-4`}>
      <div className="grid content-start gap-2">
        <strong>{state.data?.branch || "No Git branch"}</strong>
        <p className={mutedClass}>
          staged {state.data?.stagedCount ?? 0} / unstaged {state.data?.unstagedCount ?? 0} / untracked {state.data?.untrackedCount ?? 0}
        </p>
        <p className={mutedClass}>
          {state.data?.dirty ? "dirty" : "clean"} · ahead {state.data?.ahead ?? 0} / behind {state.data?.behind ?? 0}
          {state.data?.detached ? " · detached" : ""}
        </p>
        <div className="grid gap-2">
          <select className={inputClass} value={state.data?.branch ?? ""} disabled={!sessionId} onChange={(event) => checkout.mutate(event.target.value)}>
            <option value="" disabled>
              Select branch
            </option>
            {branches.data?.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input className={inputClass} value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="New branch" />
            <button className={buttonClass} type="button" disabled={!sessionId || !branchName.trim() || createBranch.isPending} onClick={() => createBranch.mutate()}>
              Create
            </button>
          </div>
          <input className={inputClass} value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message" />
          <button className={buttonClass} type="button" disabled={!sessionId || !commitMessage.trim() || commit.isPending} onClick={() => commit.mutate()}>
            Commit
          </button>
          <div className="flex items-center gap-2">
            <button className={buttonClass} type="button" disabled={!sessionId || pull.isPending} onClick={() => pull.mutate()}>
              Pull
            </button>
            <button className={buttonClass} type="button" disabled={!sessionId || push.isPending} onClick={() => push.mutate()}>
              Push
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-1 font-mono text-xs">
        {status.data?.map((file) => (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5" key={`${file.path}-${file.index}-${file.worktree}`}>
            <button className={`${buttonClass} justify-start overflow-hidden text-left font-mono`} type="button" onClick={() => setSelectedFile(file.path)}>
              {file.index}
              {file.worktree} {file.path}
            </button>
            <button className={buttonClass} type="button" onClick={() => stage.mutate(file.path)}>
              Stage
            </button>
            <button className={buttonClass} type="button" onClick={() => unstage.mutate(file.path)}>
              Unstage
            </button>
          </div>
        ))}
        {selectedFile ? (
          diff.data?.diff ? (
            <div
              className="mt-2 max-h-[155px] overflow-auto rounded-md border border-subtle bg-panel p-2 text-xs text-ink [&_pre]:whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: diffToHtml(diff.data.diff, { drawFileList: false, matching: "lines" }) }}
            />
          ) : (
            <pre className="mt-2 max-h-[155px] overflow-auto rounded-md border border-subtle bg-panel p-2 text-xs text-ink">No diff.</pre>
          )
        ) : null}
      </div>
    </div>
  );
}
