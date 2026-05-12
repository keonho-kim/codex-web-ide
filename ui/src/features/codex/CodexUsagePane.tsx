import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { CodexStatusSnapshot } from "@/lib/types";

export function CodexUsagePane({ sessionId }: { sessionId?: string }) {
  const status = useQuery({
    queryKey: ["codex", sessionId, "status"],
    queryFn: () => api<CodexStatusSnapshot>(`/api/sessions/${sessionId}/codex/status`),
    enabled: Boolean(sessionId),
  });

  if (!sessionId) return <div className="flex h-full items-center justify-center text-sm text-muted">Select a project to inspect Codex usage.</div>;
  const data = status.data;

  return (
    <section className="grid h-full min-h-0 grid-rows-[48px_minmax(0,1fr)] bg-canvas">
      <div className="flex items-center justify-between border-b border-hairline bg-panel px-4">
        <div>
          <h2 className="text-sm font-semibold">Codex Usage</h2>
          <p className="text-xs text-muted">Native /status view for the active session.</p>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={() => status.refetch()} disabled={status.isFetching}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>
      <div className="min-h-0 overflow-auto p-4">
        {status.isPending ? <p className="text-sm text-muted">Loading status.</p> : null}
        {status.error ? <p className="text-sm text-destructive">{status.error.message}</p> : null}
        {data ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <StatusCard title="Session" rows={[["Name", data.session.name], ["Directory", data.session.cwd], ["Runtime", data.session.status], ["Thread", data.thread?.title ?? "No active thread"]]} />
            <StatusCard title="Model & Permissions" rows={[["Model", data.model.label], ["Model source", data.model.source], ["Sandbox", data.permissions.sandbox], ["Approvals", data.permissions.approvals]]} />
            <StatusCard title="Git" rows={[["Branch", data.git.branch ?? (data.git.detached ? "detached" : "none")], ["Commit", data.git.commit?.slice(0, 12) ?? "-"], ["Staged", String(data.git.stagedCount)], ["Unstaged", String(data.git.unstagedCount)], ["Untracked", String(data.git.untrackedCount)]]} />
            <StatusCard
              title="Token Usage"
              rows={[
                ["Total", formatNumber(data.usage.totalTokens)],
                ["Input", formatNumber(data.usage.inputTokens)],
                ["Output", formatNumber(data.usage.outputTokens)],
                ["Reasoning", formatNumber(data.usage.reasoningOutputTokens)],
                ["Updated", data.usage.lastEventAt ? new Date(data.usage.lastEventAt).toLocaleString() : data.usage.note || "Unavailable"],
              ]}
            />
            <StatusCard title="Slash Commands" rows={[["Supported", String(data.commands.supported)], ["Source", data.commands.source]]} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <article className="rounded-md border border-subtle bg-panel p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted">{title}</h3>
      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div className="grid gap-0.5" key={label}>
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="overflow-hidden text-ellipsis text-sm whitespace-nowrap text-ink" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "-";
}
