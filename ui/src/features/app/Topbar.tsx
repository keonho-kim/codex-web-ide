import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, GitBranch, Menu, Server, Settings, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/classes";
import type { GitState, Job, ServiceInstance, Session } from "@/lib/types";
import type { WorkbenchTab } from "@/store/uiStore";
import { workbenchTabs } from "@/features/workbenchTabs";
import { GlobalSettingsDialog } from "@/features/app/GlobalSettingsDialog";

export function Topbar({
  activeSession,
  projectNavigationSlot,
  workbenchTab,
  onWorkbenchTabChange,
}: {
  activeSession?: Session;
  projectNavigationSlot?: ReactNode;
  workbenchTab: WorkbenchTab;
  onWorkbenchTabChange(tab: WorkbenchTab): void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <header className="col-span-full grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-hairline bg-canvas/95 py-3 pr-1 pl-4 shadow-[0_12px_34px_rgb(32_38_39/0.07)] max-[700px]:grid-cols-[auto_auto_minmax(0,1fr)_auto] max-[700px]:gap-2 max-[700px]:px-3 max-[700px]:py-2">
      {projectNavigationSlot}
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <SheetTrigger asChild>
          <Button aria-label="Open navigation menu" title="Navigation" className="hidden max-[700px]:inline-flex" variant="ghost" size="icon-sm" type="button">
            <Menu data-icon="inline-start" />
          </Button>
        </SheetTrigger>
        <SheetContent className="border-hairline bg-panel p-3" side="top">
          <SheetHeader className="p-0 pr-8">
            <SheetTitle className="text-sm text-ink">Navigate</SheetTitle>
            <SheetDescription className="sr-only">Switch between Chat, Editor, and System views.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-1" data-testid="mobile-navigation-menu">
            {workbenchTabs.map((item) => {
              const Icon = item.icon;
              const active = item.id === workbenchTab;
              return (
                <SheetClose asChild key={item.id}>
                  <Button
                    className={cn("justify-start", active && "border-selected-border bg-selected text-primary")}
                    variant="ghost"
                    type="button"
                    onClick={() => onWorkbenchTabChange(item.id)}
                  >
                    <Icon data-icon="inline-start" />
                    {item.label}
                  </Button>
                </SheetClose>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
      <div className="min-w-0">
        <strong className="block text-sm font-semibold tracking-normal">Codex Web IDE</strong>
        <span className="block truncate font-mono text-xs text-muted max-[700px]:text-[11px]">{activeSession?.cwd || "No project selected"}</span>
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2 max-[700px]:col-span-4 max-[700px]:row-start-2 max-[700px]:justify-start">
        <TopbarStatus session={activeSession} />
      </div>
      <Button aria-label="Open global configuration" title="Global configuration" className="justify-self-end max-[700px]:col-start-4 max-[700px]:row-start-1" variant="outline" size="icon-sm" type="button" onClick={() => setSettingsOpen(true)}>
        <Settings data-icon="inline-start" />
      </Button>
      <MobileWorkbenchTabs activeTab={workbenchTab} onChange={onWorkbenchTabChange} />
      <GlobalSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}

function TopbarStatus({ session }: { session?: Session }) {
  const sessionId = session?.id;
  const git = useQuery({
    queryKey: ["git", sessionId, "state"],
    queryFn: () => api<GitState>(`/api/sessions/${sessionId}/git/state`),
    enabled: Boolean(sessionId),
    refetchInterval: 3000,
  });
  const jobs = useQuery({
    queryKey: ["jobs", sessionId],
    queryFn: () => api<Job[]>(`/api/sessions/${sessionId}/jobs`),
    enabled: Boolean(sessionId),
  });
  const services = useQuery({
    queryKey: ["services", sessionId],
    queryFn: () => api<ServiceInstance[]>(`/api/sessions/${sessionId}/services`),
    enabled: Boolean(sessionId),
  });
  const runningJobs = jobs.data?.filter((job) => job.status === "queued" || job.status === "running").length ?? 0;
  const runningServices = services.data?.filter((service) => service.status === "starting" || service.status === "running").length ?? 0;
  const branchLabel = git.data?.branch ?? (git.data?.detached ? "detached" : "no branch");
  const dirtyLabel = git.data?.dirty ? `${git.data.stagedCount}/${git.data.unstagedCount}/${git.data.untrackedCount}` : "clean";

  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden max-[1100px]:flex-wrap max-[700px]:w-full max-[700px]:flex-nowrap max-[700px]:overflow-x-auto">
      <span className="inline-flex h-8 max-w-[190px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-selected-border bg-selected px-2.5 text-xs text-primary max-[700px]:h-7 max-[700px]:max-w-[36vw] max-[700px]:px-2" title="Git branch">
        <GitBranch size={14} />
        <span className="truncate">{sessionId ? branchLabel : "no session"}</span>
      </span>
      <span className="inline-flex h-8 max-w-[190px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-subtle bg-panel px-2.5 text-xs text-muted max-[700px]:h-7 max-[700px]:max-w-[38vw] max-[700px]:px-2" title="Session and Git status">
        <Activity size={14} />
        <span className="truncate">{session ? `${session.status} · ${dirtyLabel}` : "idle"}</span>
      </span>
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-warning-soft bg-warning-soft px-2.5 text-xs text-warning max-[700px]:h-7 max-[700px]:px-2" title="Running jobs">
        <Terminal size={14} />
        <span>{runningJobs}</span>
      </span>
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-success-soft bg-success-soft px-2.5 text-xs text-success max-[700px]:h-7 max-[700px]:px-2" title="Running services">
        <Server size={14} />
        <span>{runningServices}</span>
      </span>
    </div>
  );
}

function MobileWorkbenchTabs({ activeTab, onChange }: { activeTab: WorkbenchTab; onChange(tab: WorkbenchTab): void }) {
  return (
    <div className="col-span-4 hidden grid-cols-3 gap-1 rounded-md bg-panel p-1 max-[700px]:row-start-3 max-[700px]:mt-4 max-[700px]:grid" role="tablist" aria-label="Primary project views">
      {workbenchTabs.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeTab;
        return (
          <button
            aria-selected={active}
            className={cn(
              "inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-transparent px-1 text-[11px] text-muted transition-colors",
              active && "border-selected-border bg-selected text-primary",
            )}
            data-state={active ? "active" : "inactive"}
            key={item.id}
            role="tab"
            type="button"
            onClick={() => onChange(item.id)}
          >
            <Icon size={13} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
