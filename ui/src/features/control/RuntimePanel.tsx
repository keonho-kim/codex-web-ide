import type { ReactNode } from "react";
import { Briefcase, ExternalLink, MonitorPlay, Play, RefreshCw, RotateCw, Server, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/classes";
import type { Job, PreviewInstance, ServiceInstance } from "@/lib/types";
import { formatDuration, useJobsPanel } from "@/features/jobs/useJobsPanel";
import { usePreviewPanel } from "@/features/preview/usePreviewPanel";
import { useServicesPanel } from "@/features/services/useServicesPanel";

export function RuntimePanel({ sessionId }: { sessionId?: string }) {
  const jobs = useJobsPanel(sessionId);
  const preview = usePreviewPanel(sessionId);
  const services = useServicesPanel(sessionId);
  const errors = [jobs.actions.error, preview.actions.error, services.actions.error].filter(Boolean);
  const activeLog =
    preview.activePreview && preview.activeLogs
      ? preview.activeLogs
      : jobs.selectedJob
        ? jobs.selectedLog
        : services.latestLog;

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-auto p-4 max-[700px]:p-3">
      {errors.length > 0 ? (
        <div className="grid gap-1 rounded-md border border-destructive/30 bg-canvas p-3 text-xs text-destructive">
          {errors.map((error) => (
            <p className="m-0" key={error}>
              {error}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-3">
        <RuntimeCard icon={Briefcase} title="Jobs" meta={`${jobs.orderedJobs.length} total`}>
          <CommandRow command={jobs.command} disabled={jobs.actions.startDisabled} onCommandChange={jobs.setCommand} onStart={jobs.actions.start} />
          <div className="grid gap-1.5">
            {jobs.orderedJobs.slice(0, 4).map((job) => (
              <JobRuntimeItem
                job={job}
                key={job.id}
                selected={job.id === jobs.selectedJob?.id}
                startPending={jobs.actions.startPending}
                sessionId={sessionId}
                onCancel={jobs.actions.cancelSelected}
                onRerun={jobs.actions.rerun}
                onSelect={jobs.setSelectedJobId}
              />
            ))}
            {jobs.orderedJobs.length === 0 ? <EmptyLine>No jobs yet.</EmptyLine> : null}
          </div>
        </RuntimeCard>

        <RuntimeCard icon={MonitorPlay} title="Previews" meta={`${preview.runningPreviews.length} running`}>
          <CommandRow command={preview.command} disabled={preview.actions.startDisabled} onCommandChange={preview.setCommand} onStart={preview.actions.start} />
          <PreviewRuntimeItem activePreview={preview.activePreview} runningPreviews={preview.runningPreviews} onReload={preview.actions.reload} onRestart={preview.actions.restart} onSelectPreview={preview.actions.selectPreview} onStop={preview.actions.stop} />
        </RuntimeCard>

        <RuntimeCard icon={Server} title="Services" meta={`${services.services.length} total`}>
          <CommandRow command={services.command} disabled={services.actions.startDisabled} onCommandChange={services.setCommand} onStart={services.actions.start} />
          <div className="grid gap-1.5">
            {services.services.slice(0, 4).map((service) => (
              <ServiceRuntimeItem
                key={service.id}
                restartPending={services.actions.restartPending}
                service={service}
                stopPending={services.actions.stopPending}
                onRestart={services.actions.restart}
                onStop={services.actions.stop}
              />
            ))}
            {services.services.length === 0 ? <EmptyLine>No services yet.</EmptyLine> : null}
          </div>
        </RuntimeCard>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(260px,34%)_minmax(0,1fr)]">
        <section className="grid content-start gap-2 rounded-md border border-subtle bg-canvas p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase text-muted">Recent Activity</h3>
            <Button title="Refresh runtime" type="button" onClick={jobs.actions.refresh} variant="outline" size="icon-xs">
              <RefreshCw data-icon="inline-start" />
            </Button>
          </div>
          <ActivityLine label="Job" value={jobs.selectedJob ? `${jobs.selectedJob.status} · ${jobs.selectedJob.command.join(" ")}` : "No job selected"} />
          <ActivityLine label="Preview" value={preview.activePreview ? `${preview.activePreview.status} · port ${preview.activePreview.port}` : "No preview running"} />
          <ActivityLine label="Service" value={services.services[0] ? `${services.services[0].status} · ${services.services[0].command.join(" ")}` : "No service running"} />
        </section>
        <pre className="min-h-[240px] overflow-auto rounded-md border border-subtle bg-ink p-4 text-xs whitespace-pre-wrap text-white">{activeLog || "No runtime logs yet."}</pre>
      </div>
    </section>
  );
}

type RuntimeCardProps = {
  children: ReactNode;
  icon: typeof Briefcase;
  meta: string;
  title: string;
};

function RuntimeCard({ children, icon: Icon, meta, title }: RuntimeCardProps) {
  return (
    <section className="grid content-start gap-3 rounded-md border border-subtle bg-canvas p-3 shadow-[0_10px_24px_rgb(32_38_39/0.05)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Icon size={15} className="text-primary" />
          <span className="truncate">{title}</span>
        </h3>
        <span className="shrink-0 text-xs text-muted">{meta}</span>
      </div>
      {children}
    </section>
  );
}

function CommandRow({ command, disabled, onCommandChange, onStart }: { command: string; disabled: boolean; onCommandChange(value: string): void; onStart(): void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <input className="min-w-0 rounded-md border border-control bg-panel px-2.5 py-1.5 font-mono text-xs text-ink" value={command} onChange={(event) => onCommandChange(event.target.value)} />
      <Button title="Start" type="button" disabled={disabled} onClick={onStart} variant="outline" size="icon-sm">
        <Play data-icon="inline-start" />
      </Button>
    </div>
  );
}

function JobRuntimeItem({ job, selected, sessionId, startPending, onCancel, onRerun, onSelect }: { job: Job; selected: boolean; sessionId?: string; startPending: boolean; onCancel(): void; onRerun(job: Job): void; onSelect(id: string): void }) {
  return (
    <article className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-2 text-xs", selected ? "border-selected-border bg-selected text-primary" : "border-subtle bg-panel")}>
      <button className="min-w-0 text-left" type="button" onClick={() => onSelect(job.id)}>
        <strong className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono">{job.command.join(" ")}</strong>
        <span className="mt-1 block text-muted">
          {job.status} · {formatDuration(job)}
        </span>
      </button>
      <div className="flex gap-1">
        {job.status === "running" ? (
          <Button title="Cancel job" type="button" disabled={!sessionId} onClick={onCancel} variant="outline" size="icon-xs">
            <Square data-icon="inline-start" />
          </Button>
        ) : (
          <Button title="Rerun job" type="button" disabled={!sessionId || startPending} onClick={() => onRerun(job)} variant="outline" size="icon-xs">
            <RefreshCw data-icon="inline-start" />
          </Button>
        )}
      </div>
    </article>
  );
}

function PreviewRuntimeItem({ activePreview, runningPreviews, onReload, onRestart, onSelectPreview, onStop }: { activePreview?: PreviewInstance; runningPreviews: PreviewInstance[]; onReload(): void; onRestart(): void; onSelectPreview(id: string): void; onStop(): void }) {
  if (!activePreview) return <EmptyLine>No preview running.</EmptyLine>;

  return (
    <div className="grid gap-2 rounded-md border border-subtle bg-panel p-2 text-xs">
      {runningPreviews.length > 1 ? (
        <select className="min-w-0 rounded-md border border-control bg-canvas px-2 py-1.5 text-xs text-ink" value={activePreview.id} onChange={(event) => onSelectPreview(event.target.value)}>
          {runningPreviews.map((preview) => (
            <option key={preview.id} value={preview.id}>
              {preview.command.join(" ")}
            </option>
          ))}
        </select>
      ) : null}
      <div className="min-w-0">
        <strong className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono">{activePreview.command.join(" ")}</strong>
        <span className="mt-1 block text-muted">
          {activePreview.status} · port {activePreview.port} · pid {activePreview.pid || "-"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button title="Reload iframe" type="button" onClick={onReload} variant="outline" size="icon-xs">
          <RotateCw data-icon="inline-start" />
        </Button>
        <Button title="Restart preview" type="button" onClick={onRestart} variant="outline" size="icon-xs">
          <RefreshCw data-icon="inline-start" />
        </Button>
        <Button title="Stop preview" type="button" onClick={onStop} variant="outline" size="icon-xs">
          <Square data-icon="inline-start" />
        </Button>
        <Button asChild title="Open preview" variant="outline" size="icon-xs">
          <a href={activePreview.publicUrl} target="_blank" rel="noreferrer">
            <ExternalLink data-icon="inline-start" />
          </a>
        </Button>
      </div>
    </div>
  );
}

function ServiceRuntimeItem({ restartPending, service, stopPending, onRestart, onStop }: { restartPending: boolean; service: ServiceInstance; stopPending: boolean; onRestart(id: string): void; onStop(id: string): void }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-subtle bg-panel p-2 text-xs">
      <div className="min-w-0">
        <strong className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono">{service.command.join(" ")}</strong>
        <span className="mt-1 block text-muted">
          {service.status} · pid {service.pid || "-"} · restarts {service.restartCount}
        </span>
      </div>
      <div className="flex gap-1">
        <Button title="Restart service" type="button" disabled={restartPending} onClick={() => onRestart(service.id)} variant="outline" size="icon-xs">
          <RefreshCw data-icon="inline-start" />
        </Button>
        <Button title="Stop service" type="button" disabled={service.status === "stopped" || stopPending} onClick={() => onStop(service.id)} variant="outline" size="icon-xs">
          <Square data-icon="inline-start" />
        </Button>
      </div>
    </article>
  );
}

function ActivityLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <span className="truncate font-mono text-ink">{value}</span>
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-md border border-dashed border-subtle bg-panel p-3 text-xs text-muted">{children}</p>;
}
