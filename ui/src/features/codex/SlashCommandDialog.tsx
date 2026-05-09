import { useMemo, useState } from "react";
import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CodexSlashCommandDefinition } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";

type Options = Record<string, unknown>;

const statusItems = ["model", "reasoning", "permissions", "branch", "changes", "tokens", "raw"];
const titleItems = ["project", "thread", "branch", "status"];
const experimentalFeatures = ["goals", "plugins", "collaboration modes", "realtime", "multi agents"];

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
          <CommandBody command={command.command} values={merged} onChange={setLocal} />
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

function CommandBody({ command, values, onChange }: { command: string; values: Options; onChange(next: Options): void }) {
  if (command === "statusline") {
    return <Checklist label="Status line items" items={statusItems} selected={(values.statuslineItems as string[]) ?? []} onChange={(items) => onChange({ statuslineItems: items })} />;
  }
  if (command === "title") {
    return <Checklist label="Terminal title items" items={titleItems} selected={(values.titleItems as string[]) ?? []} onChange={(items) => onChange({ titleItems: items })} />;
  }
  if (command === "experimental") {
    const current = (values.experimentalFeatures as Record<string, boolean>) ?? {};
    return <Checklist label="Experimental features" items={experimentalFeatures} selected={experimentalFeatures.filter((item) => current[item])} onChange={(items) => onChange({ experimentalFeatures: Object.fromEntries(experimentalFeatures.map((item) => [item, items.includes(item)])) })} />;
  }
  if (command === "model") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Select label="Model" value={String(values.model ?? "Codex SDK default")} options={["Codex SDK default", "gpt-5.5", "gpt-5.4", "gpt-5.3-codex"]} onChange={(model) => onChange({ model })} />
        <Select label="Reasoning" value={String(values.reasoningEffort ?? "medium")} options={["low", "medium", "high", "xhigh"]} onChange={(reasoningEffort) => onChange({ reasoningEffort })} />
      </div>
    );
  }
  if (command === "permissions") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Select label="Sandbox" value={String(values.sandbox ?? "workspace-write")} options={["read-only", "workspace-write", "danger-full-access"]} onChange={(sandbox) => onChange({ sandbox })} />
        <Select label="Approvals" value={String(values.approvals ?? "on-request")} options={["untrusted", "on-request", "never"]} onChange={(approvals) => onChange({ approvals })} />
      </div>
    );
  }
  if (command === "vim" || command === "raw" || command === "realtime") {
    const key = command === "vim" ? "vimMode" : command === "raw" ? "rawMode" : "realtime";
    return <Toggle label={`Enable ${command}`} checked={Boolean(values[key])} onChange={(checked) => onChange({ [key]: checked })} />;
  }
  if (command === "theme") {
    return <Select label="Theme" value={String(values.theme ?? "system")} options={["system", "light", "dark", "github", "solarized"]} onChange={(theme) => onChange({ theme })} />;
  }
  return <p className="rounded-md border border-subtle bg-canvas p-3 text-sm text-muted">This command is handled by Codex Web as a native command surface. Confirm to apply it to the current session.</p>;
}

function Checklist({ label, items, selected, onChange }: { label: string; items: string[]; selected: string[]; onChange(items: string[]): void }) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <label className="flex items-center gap-2 rounded-md border border-subtle bg-canvas px-2 py-2 text-sm" key={item}>
            <input type="checkbox" checked={selected.includes(item)} onChange={(event) => onChange(event.target.checked ? [...selected, item] : selected.filter((value) => value !== item))} />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange(value: string): void }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted">
      {label}
      <select className="h-9 rounded-md border border-control bg-canvas px-2 text-sm text-ink outline-none focus:border-primary" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-subtle bg-canvas px-3 py-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function persistedSettings(command: string, values: Options) {
  if (command === "statusline") return { statuslineItems: values.statuslineItems as string[] };
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
