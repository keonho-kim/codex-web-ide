import { Bug, GitBranch, Play, Server } from "lucide-react";
import { GitPanel } from "./git/GitPanel";
import { JobsPanel } from "./jobs/JobsPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import { ServicesPanel } from "./services/ServicesPanel";
import { useUiStore } from "../store/uiStore";

export function BottomPanel({ sessionId }: { sessionId?: string }) {
  const selectedPanel = useUiStore((state) => state.selectedPanel);
  const setSelectedPanel = useUiStore((state) => state.setSelectedPanel);
  return (
    <section className="bottom-panel">
      <div className="tabs">
        <button className={selectedPanel === "git" ? "selected" : ""} type="button" onClick={() => setSelectedPanel("git")}>
          <GitBranch size={15} />
          Git
        </button>
        <button className={selectedPanel === "preview" ? "selected" : ""} type="button" onClick={() => setSelectedPanel("preview")}>
          <Play size={15} />
          Preview
        </button>
        <button className={selectedPanel === "jobs" ? "selected" : ""} type="button" onClick={() => setSelectedPanel("jobs")}>
          <Bug size={15} />
          Jobs
        </button>
        <button className={selectedPanel === "services" ? "selected" : ""} type="button" onClick={() => setSelectedPanel("services")}>
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
