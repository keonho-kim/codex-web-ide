import { BarChart3, GitBranch, PanelsTopLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeControlTab, useUiStore, type ControlTab } from "@/store/uiStore";
import { GitPanel } from "@/features/git/GitPanel";
import { RuntimePanel } from "@/features/control/RuntimePanel";
import { CodexUsagePane } from "@/features/codex/CodexUsagePane";

const controlTabs: Array<{ id: ControlTab; label: string; icon: typeof GitBranch }> = [
  { id: "git", label: "Git", icon: GitBranch },
  { id: "runtime", label: "Runtime", icon: PanelsTopLeft },
  { id: "usage", label: "Codex Usage", icon: BarChart3 },
];

export function ControlPane({ sessionId }: { sessionId?: string }) {
  const controlTab = normalizeControlTab(useUiStore((state) => state.controlTab));
  const setControlTab = useUiStore((state) => state.setControlTab);

  return (
    <Tabs className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0" value={controlTab} onValueChange={(value) => setControlTab(value as ControlTab)}>
      <div className="grid min-w-0 gap-3 border-b border-hairline bg-canvas px-4 py-3 max-[700px]:px-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">System</h2>
          <p className="truncate text-xs text-muted">Git, jobs, previews, services, and Codex runtime state.</p>
        </div>
        <TabsList className="w-full justify-start overflow-x-auto bg-panel max-[700px]:grid max-[700px]:grid-cols-3" variant="default">
          {controlTabs.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger className="min-w-24 gap-2 px-3 max-[700px]:min-w-0 max-[700px]:gap-1 max-[700px]:px-1 max-[700px]:text-[11px]" key={item.id} value={item.id}>
                <Icon data-icon="inline-start" className="shrink-0 max-[700px]:size-3.5" />
                <span className="min-w-0 truncate">{item.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      <TabsContent className="min-h-0 overflow-hidden" value="git">
        <GitPanel sessionId={sessionId} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-hidden" value="runtime">
        <RuntimePanel sessionId={sessionId} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-hidden" value="usage">
        <CodexUsagePane sessionId={sessionId} />
      </TabsContent>
    </Tabs>
  );
}
