import { EditorContent } from "@tiptap/react";
import { useState } from "react";
import { ArrowUp, Brain, ChevronDown, CircleStop, FlaskConical, GitBranch, Keyboard, Settings2, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/classes";
import { useUiStore } from "../../store/uiStore";
import { ComposerMentions } from "./ComposerMentions";
import { MentionSuggestions } from "./MentionSuggestions";
import { SlashCommandDialog } from "./SlashCommandDialog";
import { SlashCommandSuggestions } from "./SlashCommandSuggestions";
import { useComposer } from "./useComposer";

export function Composer({
  activeProjectId,
  onSessionCreated,
  sessionId,
  running = false,
}: {
  activeProjectId?: string;
  onSessionCreated(sessionId: string): void;
  sessionId?: string;
  running?: boolean;
}) {
  const composer = useComposer({ activeProjectId, onSessionCreated, sessionId });
  const settings = useUiStore((state) => state.codexCommandSettings);
  const isBusy = running || composer.runPending;
  const canStart = Boolean((sessionId || activeProjectId) && composer.draft.trim() && !isBusy);

  return (
    <div className="relative" onKeyDownCapture={(event) => composer.onKeyDown(event, isBusy)}>
      <div className="relative overflow-hidden rounded-lg border border-control bg-canvas shadow-sm transition-colors focus-within:border-primary" data-testid="composer-input">
        <ComposerConfigBar settings={settings} />
        <ComposerMentions mentions={composer.selectedMentions} onRemove={composer.removeMention} />
        {!composer.draft ? (
          <span className={cn("pointer-events-none absolute left-3 text-sm text-muted", composer.selectedMentions.length > 0 ? "top-24" : "top-[58px]")}>
            Ask Codex. Use @ for files and $ for skills.
          </span>
        ) : null}
        <EditorContent editor={composer.editor} />
        <div className="flex min-h-12 items-center justify-between gap-2 border-t border-hairline bg-panel/60 px-2.5 py-1.5 max-[700px]:flex-col max-[700px]:items-stretch">
          <span className="truncate text-[11px] text-muted max-[700px]:whitespace-normal">{settings.rawMode ? "Raw mode keeps input unchanged." : "Enter sends one line. Ctrl+Enter inserts a line."}</span>
          <div className="flex shrink-0 items-center justify-end gap-2 max-[700px]:w-full">
            {isBusy ? (
              <Button
                aria-label="Interrupt Codex"
                className="size-9 rounded-full border-control bg-canvas text-ink hover:bg-page"
                title="Interrupt Codex"
                variant="outline"
                size="icon-sm"
                type="button"
                disabled={composer.cancelPending || !sessionId}
                onClick={composer.cancelCodex}
              >
                <CircleStop data-icon="inline-start" />
              </Button>
            ) : (
              <Button
                aria-label="Send message"
                className="size-9 rounded-full border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                title="Send message"
                variant="outline"
                size="icon-sm"
                type="button"
                disabled={!canStart}
                onClick={composer.runCodex}
              >
                <ArrowUp data-icon="inline-start" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {composer.error ? <p className="mt-1 text-xs text-destructive">{composer.error}</p> : null}
      <MentionSuggestions mentionSearch={composer.activeMentionSearch} suggestions={composer.suggestions} onSelect={composer.addMention} />
      <SlashCommandSuggestions commands={composer.slashSuggestions} selectedIndex={composer.selectedSlashIndex} onSelect={composer.selectSlashCommand} />
      <SlashCommandDialog command={composer.activeSlashCommand} open={composer.slashDialogOpen} onOpenChange={composer.setSlashDialogOpen} onApply={composer.applySlashCommand} />
    </div>
  );
}

type ComposerSettings = ReturnType<typeof useUiStore.getState>["codexCommandSettings"];

function ComposerConfigBar({ settings }: { settings: ComposerSettings }) {
  const [open, setOpen] = useState(false);
  const activeExperimental = Object.values(settings.experimentalFeatures).filter(Boolean).length;
  const rows = contextRows(settings, activeExperimental);
  const summary = contextSummary(settings);

  return (
    <div className="relative flex min-h-11 items-center gap-2 border-b border-hairline bg-panel px-2.5 py-2">
      <button
        aria-expanded={open}
        aria-label="Open composer context"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-subtle bg-canvas px-2 py-1 text-[11px] font-medium text-ink hover:bg-page"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Settings2 size={12} />
        {summary}
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} size={12} />
      </button>
      {open ? (
        <div className="absolute bottom-full left-2.5 z-30 mb-2 w-[min(420px,calc(100vw-32px))] rounded-lg border border-control bg-canvas p-3 shadow-lg" data-testid="composer-context-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-xs text-ink">Context</strong>
            <span className="text-[11px] text-muted">Current run settings</span>
          </div>
          <div className="grid gap-2">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <div className="grid grid-cols-[18px_120px_minmax(0,1fr)] items-start gap-2 rounded-md border border-hairline bg-panel/70 px-2 py-2 text-xs" key={row.key}>
                  <Icon className="mt-0.5 text-muted" size={14} />
                  <span className="font-medium text-ink">{row.label}</span>
                  <span className="min-w-0 text-muted">{row.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ComposerContextRow = {
  key: string;
  icon: typeof Settings2;
  label: string;
  value: string;
};

function contextSummary(settings: ComposerSettings) {
  const visible = settings.statuslineItems.filter((item) => item === "model" || item === "reasoning" || item === "permissions").slice(0, 2);
  return visible.length > 0 ? `Context: ${visible.join(" · ")}` : "Context";
}

function contextRows(settings: ComposerSettings, activeExperimental: number) {
  const rows: ComposerContextRow[] = [
    { key: "model", icon: Sparkles, label: "Model", value: settings.model },
    { key: "reasoning", icon: Brain, label: "Reasoning", value: settings.reasoningEffort },
    { key: "sandbox", icon: ShieldCheck, label: "Sandbox", value: settings.sandbox },
    { key: "approvals", icon: ShieldCheck, label: "Approvals", value: settings.approvals },
    { key: "branch", icon: GitBranch, label: "Git branch", value: "Shown in the top status bar" },
    { key: "changes", icon: GitBranch, label: "Git changes", value: "Not available yet" },
    { key: "tokens", icon: Sparkles, label: "Token usage", value: "Not available yet" },
    { key: "raw", icon: Terminal, label: "Raw mode", value: settings.rawMode ? "Enabled" : "Disabled" },
  ];
  if (settings.vimMode) rows.push({ key: "vim", icon: Keyboard, label: "Vim mode", value: "Enabled" });
  if (settings.rawMode) rows.push({ key: "raw-mode", icon: Terminal, label: "Raw mode", value: "Input is sent unchanged" });
  if (activeExperimental > 0) rows.push({ key: "experimental", icon: FlaskConical, label: "Experimental", value: `${activeExperimental} feature${activeExperimental === 1 ? "" : "s"} enabled` });
  return rows;
}
