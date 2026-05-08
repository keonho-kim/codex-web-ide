import { Bug, GitBranch, Play, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <section className="bottom-panel">
      <div className="bottom-tabs">
        <Button className={cn(selectedPanel === "git" && "panel-tab-selected")} type="button" onClick={() => setSelectedPanel("git")} variant="outline" size="sm">
          <GitBranch data-icon="inline-start" />
          Git
        </Button>
        <Button className={cn(selectedPanel === "preview" && "panel-tab-selected")} type="button" onClick={() => setSelectedPanel("preview")} variant="outline" size="sm">
          <Play data-icon="inline-start" />
          Preview
        </Button>
        <Button className={cn(selectedPanel === "jobs" && "panel-tab-selected")} type="button" onClick={() => setSelectedPanel("jobs")} variant="outline" size="sm">
          <Bug data-icon="inline-start" />
          Jobs
        </Button>
        <Button className={cn(selectedPanel === "services" && "panel-tab-selected")} type="button" onClick={() => setSelectedPanel("services")} variant="outline" size="sm">
          <Server data-icon="inline-start" />
          Services
        </Button>
      </div>
      {selectedPanel === "git" ? <GitPanel sessionId={sessionId} /> : null}
      {selectedPanel === "preview" ? <PreviewPanel sessionId={sessionId} /> : null}
      {selectedPanel === "jobs" ? <JobsPanel sessionId={sessionId} /> : null}
      {selectedPanel === "services" ? <ServicesPanel sessionId={sessionId} /> : null}
    </section>
  );
}
