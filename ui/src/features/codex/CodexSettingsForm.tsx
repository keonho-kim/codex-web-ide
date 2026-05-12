import type { UiState } from "@/store/uiStore";
import { STATUSLINE_ITEMS, normalizeStatuslineItems, type CodexStatusLineItem } from "@/lib/statusline";

export type CodexCommandSettings = UiState["codexCommandSettings"];
export type CodexSettingsPatch = Partial<CodexCommandSettings>;

export const titleItems = ["project", "thread", "branch", "status"];
export const experimentalFeatures = ["goals", "plugins", "collaboration modes", "realtime", "multi agents"];

export function CodexSettingsForm({
  values,
  onChange,
}: {
  values: CodexCommandSettings;
  onChange(next: CodexSettingsPatch): void;
}) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <h3 className="text-xs font-semibold uppercase text-muted">Display</h3>
        <StatuslineChecklist
          selected={values.statuslineItems}
          useThemeColors={values.useThemeColors}
          onChange={(statuslineItems) => onChange({ statuslineItems })}
          onThemeColorsChange={(useThemeColors) => onChange({ useThemeColors })}
        />
        <Checklist label="Terminal title items" items={titleItems} selected={values.titleItems} onChange={(titleItems) => onChange({ titleItems })} />
      </section>
      <section className="grid gap-3">
        <h3 className="text-xs font-semibold uppercase text-muted">Runtime</h3>
        <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
          <Select label="Model" value={values.model} options={["Codex SDK default", "gpt-5.5", "gpt-5.4", "gpt-5.3-codex"]} onChange={(model) => onChange({ model })} />
          <Select label="Reasoning" value={values.reasoningEffort} options={["low", "medium", "high", "xhigh"]} onChange={(reasoningEffort) => onChange({ reasoningEffort })} />
          <Select label="Sandbox" value={values.sandbox} options={["read-only", "workspace-write", "danger-full-access"]} onChange={(sandbox) => onChange({ sandbox })} />
          <Select label="Approvals" value={values.approvals} options={["untrusted", "on-request", "never"]} onChange={(approvals) => onChange({ approvals })} />
        </div>
      </section>
      <section className="grid gap-3">
        <h3 className="text-xs font-semibold uppercase text-muted">Modes</h3>
        <div className="grid grid-cols-2 gap-2 max-[700px]:grid-cols-1">
          <Toggle label="Vim mode" checked={values.vimMode} onChange={(vimMode) => onChange({ vimMode })} />
          <Toggle label="Raw mode" checked={values.rawMode} onChange={(rawMode) => onChange({ rawMode })} />
        </div>
        <Select label="Theme" value={values.theme} options={["system", "light", "dark", "github", "solarized"]} onChange={(theme) => onChange({ theme })} />
      </section>
      <Checklist
        label="Experimental features"
        items={experimentalFeatures}
        selected={experimentalFeatures.filter((item) => values.experimentalFeatures[item])}
        onChange={(items) => onChange({ experimentalFeatures: Object.fromEntries(experimentalFeatures.map((item) => [item, items.includes(item)])) })}
      />
    </div>
  );
}

export function CommandSettingsBody({ command, values, onChange }: { command: string; values: Record<string, unknown>; onChange(next: Record<string, unknown>): void }) {
  if (command === "statusline") {
    return (
      <StatuslineChecklist
        selected={normalizeStatuslineItems(values.statuslineItems as string[] | undefined)}
        useThemeColors={Boolean(values.useThemeColors ?? true)}
        onChange={(statuslineItems) => onChange({ statuslineItems })}
        onThemeColorsChange={(useThemeColors) => onChange({ useThemeColors })}
      />
    );
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

function StatuslineChecklist({
  selected,
  useThemeColors,
  onChange,
  onThemeColorsChange,
}: {
  selected: readonly string[];
  useThemeColors: boolean;
  onChange(items: CodexStatusLineItem[]): void;
  onThemeColorsChange(checked: boolean): void;
}) {
  const normalized = normalizeStatuslineItems(selected);
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-muted">Status line items</span>
        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={useThemeColors} onChange={(event) => onThemeColorsChange(event.target.checked)} />
          Use theme colors
        </label>
      </div>
      <div className="grid gap-2">
        {STATUSLINE_ITEMS.map((item) => (
          <label className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-md border border-subtle bg-canvas px-3 py-2 text-sm" key={item.id}>
            <input className="mt-1" type="checkbox" checked={normalized.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...normalized, item.id] : normalized.filter((value) => value !== item.id))} />
            <span className="grid gap-0.5">
              <span className="font-mono text-xs font-semibold text-ink">{item.label}</span>
              <span className="text-xs text-muted">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Checklist({ label, items, selected, onChange }: { label: string; items: string[]; selected: string[]; onChange(items: string[]): void }) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="grid grid-cols-2 gap-2 max-[700px]:grid-cols-1">
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
