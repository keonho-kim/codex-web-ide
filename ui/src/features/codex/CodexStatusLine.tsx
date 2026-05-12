import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/classes";
import { normalizeStatuslineItems, type CodexStatusLineItem } from "@/lib/statusline";
import type { CodexStatusSnapshot, Job, ServiceInstance } from "@/lib/types";
import { useUiStore } from "@/store/uiStore";

export function CodexStatusLine({ running, sessionId }: { running?: boolean; sessionId?: string }) {
  const settings = useUiStore((state) => state.codexCommandSettings);
  const status = useQuery({
    queryKey: ["codex", sessionId, "status"],
    queryFn: () => api<CodexStatusSnapshot>(`/api/sessions/${sessionId}/codex/status`),
    enabled: Boolean(sessionId),
    refetchInterval: running ? 1000 : 3000,
  });
  const jobs = useQuery({
    queryKey: ["jobs", sessionId],
    queryFn: () => api<Job[]>(`/api/sessions/${sessionId}/jobs`),
    enabled: Boolean(sessionId),
    refetchInterval: running ? 1000 : 5000,
  });
  const services = useQuery({
    queryKey: ["services", sessionId],
    queryFn: () => api<ServiceInstance[]>(`/api/sessions/${sessionId}/services`),
    enabled: Boolean(sessionId),
    refetchInterval: 5000,
  });

  const segments = useMemo(
    () =>
      normalizeStatuslineItems(settings.statuslineItems)
        .map((item) =>
          statuslineSegment(item, {
            jobs: jobs.data ?? [],
            model: settings.model,
            reasoning: settings.reasoningEffort,
            running: Boolean(running),
            services: services.data ?? [],
            status: status.data,
          }),
        )
        .filter((segment): segment is StatusLineSegment => Boolean(segment)),
    [jobs.data, running, services.data, settings.model, settings.reasoningEffort, settings.statuslineItems, status.data],
  );

  return (
    <div
      aria-label="Codex status line"
      className="flex min-h-11 items-center gap-2 overflow-hidden border-b border-hairline bg-panel px-2.5 py-2 font-mono text-[11px]"
      data-testid="codex-statusline"
    >
      {segments.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {segments.map((segment, index) => (
            <span className="inline-flex min-w-0 items-center gap-2" key={segment.item}>
              {index > 0 ? <span className="text-muted">·</span> : null}
              <span className={cn("truncate", segmentClass(segment.item, settings.useThemeColors))} title={segment.title ?? segment.value}>
                {segment.value}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-muted">Status line values are not available yet.</span>
      )}
    </div>
  );
}

type StatusLineSegment = {
  item: CodexStatusLineItem;
  value: string;
  title?: string;
};

type SegmentContext = {
  jobs: Job[];
  model: string;
  reasoning: string;
  running: boolean;
  services: ServiceInstance[];
  status?: CodexStatusSnapshot;
};

function statuslineSegment(item: CodexStatusLineItem, context: SegmentContext): StatusLineSegment | null {
  if (item === "current-dir") {
    const cwd = context.status?.session.cwd;
    return cwd ? { item, value: compactPath(cwd), title: cwd } : null;
  }
  if (item === "git-branch") {
    const git = context.status?.git;
    const branch = git?.branch ?? (git?.detached ? "detached" : "");
    return branch ? { item, value: branch } : null;
  }
  if (item === "model-with-reasoning") {
    const model = context.model === "Codex SDK default" ? (context.status?.model.label ?? context.model) : context.model;
    return { item, value: `${model} ${context.reasoning}` };
  }
  if (item === "run-state") {
    return { item, value: runState(context) };
  }
  if (item === "task-progress") {
    const runningJobs = context.jobs.filter((job) => job.status === "queued" || job.status === "running").length;
    const runningServices = context.services.filter((service) => service.status === "starting" || service.status === "running").length;
    const active = runningJobs + runningServices + (context.running ? 1 : 0);
    return { item, value: active > 0 ? `Tasks ${active} active` : "Tasks 0" };
  }
  if (item === "context-remaining" || item === "context-window-size" || item === "five-hour-limit") {
    return null;
  }
  return null;
}

function runState(context: SegmentContext) {
  if (context.running || context.status?.session.status === "running") return "Working";
  if (context.status?.session.status === "error") return "Error";
  return "Ready";
}

function compactPath(path: string) {
  const homeMatch = path.match(/^\/Users\/[^/]+(?:\/(.*))?$/);
  if (homeMatch) return homeMatch[1] ? `~/${homeMatch[1]}` : "~";
  return path;
}

function segmentClass(item: CodexStatusLineItem, useThemeColors: boolean) {
  if (!useThemeColors) return "text-ink";
  if (item === "context-remaining" || item === "five-hour-limit") return "text-warning";
  if (item === "current-dir") return "text-success";
  if (item === "git-branch") return "text-primary";
  if (item === "run-state" || item === "task-progress") return "text-muted";
  return "text-ink";
}
