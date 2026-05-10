import { useMemo, useState } from "react";
import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeStatuslineItems } from "../../lib/statusline";
import type { CodexSlashCommandDefinition } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";
import { CommandSettingsBody } from "./CodexSettingsForm";

type Options = Record<string, unknown>;

export function SlashCommandDialog({
  command,
  open,
  onOpenChange,
  onApply,
}: {
  command: CodexSlashCommandDefinition | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  onApply(command: CodexSlashCommandDefinition, options: Options, args?: string): void;
}) {
  const settings = useUiStore((state) => state.codexCommandSettings);
  const updateSettings = useUiStore((state) => state.updateCodexCommandSettings);
  const [args, setArgs] = useState("");
  const [local, setLocal] = useState<Options>({});

  const merged = useMemo(() => ({ ...settings, ...local }), [local, settings]);
  if (!command) return null;

  const apply = () => {
    const persisted = persistedSettings(command.command, merged);
    if (persisted) updateSettings(persisted);
    onApply(command, merged, args);
    setArgs("");
    setLocal({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>/{command.command}</DialogTitle>
          <DialogDescription>{command.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <CommandSettingsBody command={command.command} values={merged} onChange={(next) => setLocal((current) => ({ ...current, ...next }))} />
          {command.supportsInlineArgs ? (
            <label className="grid gap-1 text-xs font-medium text-muted">
              Arguments
              <input
                className="h-9 rounded-md border border-control bg-canvas px-2 text-sm text-ink outline-none focus:border-primary"
                value={args}
                onChange={(event) => setArgs(event.target.value)}
                placeholder={argumentPlaceholder(command.command)}
              />
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={apply}>
            {command.requiresConfirmation ? <Check data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function persistedSettings(command: string, values: Options) {
  if (command === "statusline") return { statuslineItems: normalizeStatuslineItems(values.statuslineItems as string[] | undefined), useThemeColors: Boolean(values.useThemeColors ?? true) };
  if (command === "title") return { titleItems: values.titleItems as string[] };
  if (command === "experimental") return { experimentalFeatures: values.experimentalFeatures as Record<string, boolean> };
  if (command === "model") return { model: String(values.model), reasoningEffort: String(values.reasoningEffort) };
  if (command === "permissions") return { sandbox: String(values.sandbox), approvals: String(values.approvals) };
  if (command === "vim") return { vimMode: Boolean(values.vimMode) };
  if (command === "raw") return { rawMode: Boolean(values.rawMode) };
  if (command === "theme") return { theme: String(values.theme) };
  return null;
}

function argumentPlaceholder(command: string) {
  if (command === "rename") return "Thread title";
  if (command === "review") return "Optional review instructions";
  if (command === "goal") return "Objective, pause, resume, or clear";
  if (command === "mcp") return "verbose";
  return "Optional arguments";
}
