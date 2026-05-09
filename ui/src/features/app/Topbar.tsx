import { useQuery } from "@tanstack/react-query";
import { Activity, GitBranch, Server, Terminal } from "lucide-react";
import { api } from "../../lib/api";
import type { GitState, Job, ServiceInstance, Session } from "../../lib/types";

export function Topbar({
  activeSession,
}: {
  activeSession?: Session;
}) {
  return (
    <header className="col-span-full flex items-center justify-between gap-4 rounded-lg border border-hairline bg-canvas px-4 py-3 max-[900px]:items-start max-[700px]:flex-col max-[700px]:gap-3">
      <div className="min-w-0">
        <strong className="block text-sm font-semibold tracking-normal">Codex Web IDE</strong>
        <span className="block truncate font-mono text-xs text-muted">{activeSession?.cwd || "No project selected"}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 max-[900px]:flex-wrap max-[700px]:w-full max-[700px]:overflow-x-auto">
        <TopbarStatus session={activeSession} />
      </div>
    </header>
  );
}

function TopbarStatus({ session }: { session?: Session }) {
  const sessionId = session?.id;
  const git = useQuery({
    queryKey: ["git", sessionId, "state"],
    queryFn: () => api<GitState>(`/api/sessions/${sessionId}/git/state`),
    enabled: Boolean(sessionId),
    refetchInterval: 3000,
  });
  const jobs = useQuery({
    queryKey: ["jobs", sessionId],
    queryFn: () => api<Job[]>(`/api/sessions/${sessionId}/jobs`),
    enabled: Boolean(sessionId),
  });
  const services = useQuery({
    queryKey: ["services", sessionId],
    queryFn: () => api<ServiceInstance[]>(`/api/sessions/${sessionId}/services`),
    enabled: Boolean(sessionId),
  });
  const runningJobs = jobs.data?.filter((job) => job.status === "queued" || job.status === "running").length ?? 0;
  const runningServices = services.data?.filter((service) => service.status === "starting" || service.status === "running").length ?? 0;
  const branchLabel = git.data?.branch ?? (git.data?.detached ? "detached" : "no branch");
  const dirtyLabel = git.data?.dirty ? `${git.data.stagedCount}/${git.data.unstagedCount}/${git.data.untrackedCount}` : "clean";

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden max-[900px]:flex-wrap max-[700px]:flex-nowrap">
      <span className="inline-flex h-8 max-w-[190px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-selected-border bg-selected px-2.5 text-xs text-primary" title="Git branch">
        <GitBranch size={14} />
        <span className="truncate">{sessionId ? branchLabel : "no session"}</span>
      </span>
      <span className="inline-flex h-8 max-w-[190px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-subtle bg-panel px-2.5 text-xs text-muted" title="Session and Git status">
        <Activity size={14} />
        <span className="truncate">{session ? `${session.status} · ${dirtyLabel}` : "idle"}</span>
      </span>
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-warning-soft bg-warning-soft px-2.5 text-xs text-warning" title="Running jobs">
        <Terminal size={14} />
        <span>{runningJobs}</span>
      </span>
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-success-soft bg-success-soft px-2.5 text-xs text-success" title="Running services">
        <Server size={14} />
        <span>{runningServices}</span>
      </span>
    </div>
  );
}
