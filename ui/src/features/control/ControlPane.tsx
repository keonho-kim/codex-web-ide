import { Bug, GitBranch, MonitorPlay, Server } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeControlTab, useUiStore, type ControlTab } from "@/store/uiStore";
import { GitPanel } from "@/features/git/GitPanel";
import { JobsPanel } from "@/features/jobs/JobsPanel";
import { PreviewPanel } from "@/features/preview/PreviewPanel";
import { ServicesPanel } from "@/features/services/ServicesPanel";

const controlTabs: Array<{ id: ControlTab; label: string; icon: typeof GitBranch }> = [
  { id: "git", label: "Git", icon: GitBranch },
  { id: "jobs", label: "Jobs", icon: Bug },
  { id: "previews", label: "Previews", icon: MonitorPlay },
  { id: "services", label: "Services", icon: Server },
];

export function ControlPane({ sessionId }: { sessionId?: string }) {
  const controlTab = normalizeControlTab(useUiStore((state) => state.controlTab));
  const setControlTab = useUiStore((state) => state.setControlTab);

  return (
    <Tabs className="grid h-full min-h-0 grid-rows-[48px_minmax(0,1fr)] gap-0" value={controlTab} onValueChange={(value) => setControlTab(value as ControlTab)}>
      <div className="flex min-w-0 items-center border-b border-hairline bg-canvas px-4 py-2 max-[700px]:px-3">
        <TabsList className="bg-panel" variant="default">
          {controlTabs.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger className="min-w-24 gap-2 px-3" key={item.id} value={item.id}>
                <Icon data-icon="inline-start" />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      <TabsContent className="min-h-0 overflow-hidden" value="git">
        <GitPanel sessionId={sessionId} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-hidden" value="jobs">
        <JobsPanel sessionId={sessionId} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-hidden" value="previews">
        <PreviewPanel sessionId={sessionId} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-hidden" value="services">
        <ServicesPanel sessionId={sessionId} />
      </TabsContent>
    </Tabs>
  );
}
