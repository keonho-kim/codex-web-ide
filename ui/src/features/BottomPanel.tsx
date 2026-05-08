import { Bug, GitBranch, Play, Server } from "lucide-react";
import { GitPanel } from "./git/GitPanel";
import { JobsPanel } from "./jobs/JobsPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import { ServicesPanel } from "./services/ServicesPanel";
import { cn } from "../lib/classes";
import { useUiStore } from "../store/uiStore";

export function BottomPanel({ sessionId }: { sessionId?: string }) {
  const selectedPanel = useUiStore((state) => state.selectedPanel);
  const setSelectedPanel = useUiStore((state) => state.setSelectedPanel);
  return (
    <section className="min-h-0 overflow-hidden border-t border-hairline bg-canvas">
      <div className="flex h-[38px] items-center gap-2 border-b border-hairline px-2 py-1">
        <button
          className={cn(
            "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50",
            selectedPanel === "git" && "border-selected-border bg-selected text-primary",
          )}
          type="button"
          onClick={() => setSelectedPanel("git")}
        >
          <GitBranch size={15} />
          Git
        </button>
        <button
          className={cn(
            "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50",
            selectedPanel === "preview" && "border-selected-border bg-selected text-primary",
          )}
          type="button"
          onClick={() => setSelectedPanel("preview")}
        >
          <Play size={15} />
          Preview
        </button>
        <button
          className={cn(
            "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50",
            selectedPanel === "jobs" && "border-selected-border bg-selected text-primary",
          )}
          type="button"
          onClick={() => setSelectedPanel("jobs")}
        >
          <Bug size={15} />
          Jobs
        </button>
        <button
          className={cn(
            "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50",
            selectedPanel === "services" && "border-selected-border bg-selected text-primary",
          )}
          type="button"
          onClick={() => setSelectedPanel("services")}
        >
          <Server size={15} />
          Services
        </button>
      </div>
      {selectedPanel === "git" ? <GitPanel sessionId={sessionId} /> : null}
      {selectedPanel === "preview" ? <PreviewPanel sessionId={sessionId} /> : null}
      {selectedPanel === "jobs" ? <JobsPanel sessionId={sessionId} /> : null}
      {selectedPanel === "services" ? <ServicesPanel sessionId={sessionId} /> : null}
    </section>
  );
}
