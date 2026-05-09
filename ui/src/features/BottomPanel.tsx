import { Bug, GitBranch, PanelBottomClose, PanelBottomOpen, Play, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitPanel } from "./git/GitPanel";
import { JobsPanel } from "./jobs/JobsPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import { ServicesPanel } from "./services/ServicesPanel";
import { cn } from "../lib/classes";
import { useUiStore } from "../store/uiStore";

export function BottomPanel({ sessionId }: { sessionId?: string }) {
  const selectedPanel = useUiStore((state) => state.selectedPanel);
  const collapsed = useUiStore((state) => state.collapsedMainPanels.bottom);
  const setSelectedPanel = useUiStore((state) => state.setSelectedPanel);
  const toggleMainPanel = useUiStore((state) => state.toggleMainPanel);
  return (
    <section className="min-h-0 overflow-hidden border-t border-hairline bg-canvas">
      <div className="flex h-[38px] items-center gap-2 overflow-x-auto border-b border-hairline bg-panel px-2 py-1">
        <Button title={collapsed ? "Expand bottom panel" : "Collapse bottom panel"} type="button" onClick={() => toggleMainPanel("bottom")} variant="outline" size="icon-xs">
          {collapsed ? <PanelBottomOpen data-icon="inline-start" /> : <PanelBottomClose data-icon="inline-start" />}
        </Button>
        <Button className={cn(selectedPanel === "git" && "border-selected-border bg-selected text-primary")} type="button" onClick={() => setSelectedPanel("git")} variant="outline" size="sm">
          <GitBranch data-icon="inline-start" />
          Git
        </Button>
        <Button className={cn(selectedPanel === "preview" && "border-selected-border bg-selected text-primary")} type="button" onClick={() => setSelectedPanel("preview")} variant="outline" size="sm">
          <Play data-icon="inline-start" />
          Preview
        </Button>
        <Button className={cn(selectedPanel === "jobs" && "border-selected-border bg-selected text-primary")} type="button" onClick={() => setSelectedPanel("jobs")} variant="outline" size="sm">
          <Bug data-icon="inline-start" />
          Jobs
        </Button>
        <Button className={cn(selectedPanel === "services" && "border-selected-border bg-selected text-primary")} type="button" onClick={() => setSelectedPanel("services")} variant="outline" size="sm">
          <Server data-icon="inline-start" />
          Services
        </Button>
      </div>
      {!collapsed && selectedPanel === "git" ? <GitPanel sessionId={sessionId} /> : null}
      {!collapsed && selectedPanel === "preview" ? <PreviewPanel sessionId={sessionId} /> : null}
      {!collapsed && selectedPanel === "jobs" ? <JobsPanel sessionId={sessionId} /> : null}
      {!collapsed && selectedPanel === "services" ? <ServicesPanel sessionId={sessionId} /> : null}
    </section>
  );
}
