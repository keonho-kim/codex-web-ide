import { useMemo, useState } from "react";
import { Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CodexSettingsForm, type CodexSettingsPatch } from "@/features/codex/CodexSettingsForm";
import { useUiStore } from "@/store/uiStore";

export function GlobalSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const settings = useUiStore((state) => state.codexCommandSettings);
  const updateSettings = useUiStore((state) => state.updateCodexCommandSettings);
  const [local, setLocal] = useState<CodexSettingsPatch>({});
  const merged = useMemo(() => ({ ...settings, ...local }), [local, settings]);

  const apply = () => {
    updateSettings(local);
    setLocal({});
    onOpenChange(false);
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) setLocal({});
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="grid max-h-[min(760px,calc(100vh-2rem))] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={18} />
            Global Configuration
          </DialogTitle>
          <DialogDescription>Configure Codex display, runtime, and mode defaults for this browser workspace.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          <CodexSettingsForm
            values={merged}
            onChange={(patch) => {
              setLocal((current) => ({ ...current, ...patch }));
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={apply}>
            <Check data-icon="inline-start" />
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
