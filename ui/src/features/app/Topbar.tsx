import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, GitBranch, Play, Server, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCreator } from "../projects/ProjectCreator";
import { SessionCreator } from "../projects/SessionCreator";
import { api } from "../../lib/api";
import type { GitState, Job, PreviewInstance, Project, ServiceInstance, Session, WorkspaceSettings } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";

export function Topbar({
  activeProjectId,
  activeSession,
  defaultProjectsDir,
  onProjectCreated,
  onSessionCreated,
}: {
  activeProjectId?: string;
  activeSession?: Session;
  defaultProjectsDir?: WorkspaceSettings["defaultProjectsDir"];
  onProjectCreated(project: Project): void;
  onSessionCreated(session: Session): void;
}) {
  return (
    <header className="col-span-full flex items-center justify-between gap-4 border-b border-hairline bg-canvas/95 px-3 backdrop-blur max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-2 max-[900px]:p-2">
      <div className="min-w-0">
        <strong className="block text-[13px] font-semibold tracking-normal">Codex Web IDE</strong>
        <span className="block overflow-hidden font-mono text-[11px] text-ellipsis whitespace-nowrap text-muted">{activeSession?.cwd || "No session selected"}</span>
      </div>
      <div className="flex items-center gap-2 max-[900px]:flex-wrap max-[900px]:items-stretch max-[700px]:overflow-x-auto">
        <TopbarStatus session={activeSession} />
        <ProjectCreator defaultProjectsDir={defaultProjectsDir} onCreated={onProjectCreated} />
        <SessionCreator projectId={activeProjectId} onCreated={onSessionCreated} />
      </div>
    </header>
  );
}

function TopbarStatus({ session }: { session?: Session }) {
  const queryClient = useQueryClient();
  const setSelectedPanel = useUiStore((state) => state.setSelectedPanel);
  const setSelectedPreviewId = useUiStore((state) => state.setSelectedPreviewId);
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
  const previews = useQuery({
    queryKey: ["previews", sessionId],
    queryFn: () => api<PreviewInstance[]>(`/api/sessions/${sessionId}/previews`),
    enabled: Boolean(sessionId),
  });
  const services = useQuery({
    queryKey: ["services", sessionId],
    queryFn: () => api<ServiceInstance[]>(`/api/sessions/${sessionId}/services`),
    enabled: Boolean(sessionId),
  });
  const startPreview = useMutation({
    mutationFn: () =>
      api<PreviewInstance>(`/api/sessions/${sessionId}/previews`, {
        method: "POST",
        body: { command: ["bun", "run", "dev"] },
      }),
    onSuccess: async (preview) => {
      setSelectedPreviewId(preview.id);
      setSelectedPanel("preview");
      await queryClient.invalidateQueries({ queryKey: ["previews", sessionId] });
    },
  });

  const activePreview = previews.data?.find((preview) => preview.status === "running" || preview.status === "starting");
  const runningJobs = jobs.data?.filter((job) => job.status === "queued" || job.status === "running").length ?? 0;
  const runningServices = services.data?.filter((service) => service.status === "starting" || service.status === "running").length ?? 0;
  const branchLabel = git.data?.branch ?? (git.data?.detached ? "detached" : "no branch");
  const dirtyLabel = git.data?.dirty ? `${git.data.stagedCount}/${git.data.unstagedCount}/${git.data.untrackedCount}` : "clean";

  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden max-[900px]:flex-wrap max-[700px]:flex-nowrap">
      <span className="inline-flex h-7 max-w-[180px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-selected-border bg-selected px-2 text-xs text-primary" title="Git branch">
        <GitBranch size={14} />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{sessionId ? branchLabel : "no session"}</span>
      </span>
      <span className="inline-flex h-7 max-w-[180px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-subtle bg-panel px-2 text-xs text-muted" title="Session and Git status">
        <Activity size={14} />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{session ? `${session.status} · ${dirtyLabel}` : "idle"}</span>
      </span>
      <span className="inline-flex h-7 max-w-[180px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-warning-soft bg-warning-soft px-2 text-xs text-warning" title="Running jobs">
        <Terminal size={14} />
        <span>{runningJobs}</span>
      </span>
      <span className="inline-flex h-7 max-w-[180px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-success-soft bg-success-soft px-2 text-xs text-success" title="Running services">
        <Server size={14} />
        <span>{runningServices}</span>
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!sessionId || startPreview.isPending}
        onClick={() => {
          if (activePreview) {
            setSelectedPreviewId(activePreview.id);
            setSelectedPanel("preview");
            return;
          }
          startPreview.mutate();
        }}
      >
        <Play data-icon="inline-start" />
        {activePreview ? "Preview" : "Start preview"}
      </Button>
      {startPreview.error ? <span className="text-xs text-destructive">{startPreview.error instanceof Error ? startPreview.error.message : "Preview failed."}</span> : null}
    </div>
  );
}
