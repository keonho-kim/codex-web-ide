import { Bug, GitBranch, Play, Server } from "lucide-react";
import { GitPanel } from "./git/GitPanel";
import { JobsPanel } from "./jobs/JobsPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import { ServicesPanel } from "./services/ServicesPanel";
import { buttonClass, selectedListButtonClass } from "../components/uiClasses";
import { useUiStore } from "../store/uiStore";

export function BottomPanel({ sessionId }: { sessionId?: string }) {
  const selectedPanel = useUiStore((state) => state.selectedPanel);
  const setSelectedPanel = useUiStore((state) => state.setSelectedPanel);
  return (
    <section className="min-h-0 overflow-hidden border-t border-[#e0e0e0] bg-white">
      <div className="flex h-[38px] items-center gap-2 border-b border-[#e0e0e0] px-2 py-1">
        <button className={`${buttonClass} ${selectedPanel === "git" ? selectedListButtonClass : ""}`} type="button" onClick={() => setSelectedPanel("git")}>
          <GitBranch size={15} />
          Git
        </button>
        <button className={`${buttonClass} ${selectedPanel === "preview" ? selectedListButtonClass : ""}`} type="button" onClick={() => setSelectedPanel("preview")}>
          <Play size={15} />
          Preview
        </button>
        <button className={`${buttonClass} ${selectedPanel === "jobs" ? selectedListButtonClass : ""}`} type="button" onClick={() => setSelectedPanel("jobs")}>
          <Bug size={15} />
          Jobs
        </button>
        <button className={`${buttonClass} ${selectedPanel === "services" ? selectedListButtonClass : ""}`} type="button" onClick={() => setSelectedPanel("services")}>
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
