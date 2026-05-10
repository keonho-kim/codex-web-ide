import { EditorContent } from "@tiptap/react";
import { Brain, Coins, Diff, FlaskConical, GitBranch, Keyboard, Play, Settings2, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/classes";
import { useUiStore } from "../../store/uiStore";
import { ComposerMentions } from "./ComposerMentions";
import { MentionSuggestions } from "./MentionSuggestions";
import { SlashCommandDialog } from "./SlashCommandDialog";
import { SlashCommandSuggestions } from "./SlashCommandSuggestions";
import { useComposer } from "./useComposer";

export function Composer({ sessionId, running = false }: { sessionId?: string; running?: boolean }) {
  const composer = useComposer(sessionId);
  const settings = useUiStore((state) => state.codexCommandSettings);
  const isBusy = running || composer.runPending;

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
              <Button variant="outline" size="sm" type="button" disabled={composer.cancelPending} onClick={composer.cancelCodex}>
                Cancel
              </Button>
            ) : null}
            <Button variant="outline" size="sm" type="button" disabled={!sessionId || isBusy || !composer.draft.trim()} onClick={composer.runCodex}>
              <Play data-icon="inline-start" />
              Run
            </Button>
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
  const activeExperimental = Object.values(settings.experimentalFeatures).filter(Boolean).length;
  const items = settings.statuslineItems
    .map((item) => statusItem(item, settings))
    .filter((item): item is ComposerConfigItem => Boolean(item));
  if (settings.vimMode) items.push({ key: "vim", icon: Keyboard, label: "vim" });
  if (settings.rawMode) items.push({ key: "raw-mode", icon: Terminal, label: "raw" });
  if (activeExperimental > 0) items.push({ key: "experimental", icon: FlaskConical, label: `${activeExperimental} exp` });

  return (
    <div className="flex min-h-11 items-center gap-2 overflow-x-auto border-b border-hairline bg-panel px-2.5 py-2">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-subtle bg-canvas px-2 py-1 text-[11px] font-medium text-ink">
        <Settings2 size={12} />
        Chat
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-subtle bg-canvas px-2 py-1 text-[11px] text-muted" key={item.key} title={item.title ?? item.label}>
              <Icon size={12} />
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

type ComposerConfigItem = {
  key: string;
  icon: typeof Settings2;
  label: string;
  title?: string;
};

function statusItem(item: string, settings: ComposerSettings): ComposerConfigItem | null {
  if (item === "model") return { key: item, icon: Sparkles, label: settings.model };
  if (item === "reasoning") return { key: item, icon: Brain, label: settings.reasoningEffort };
  if (item === "permissions") return { key: item, icon: ShieldCheck, label: `${settings.sandbox} / ${settings.approvals}` };
  if (item === "branch") return { key: item, icon: GitBranch, label: "branch" };
  if (item === "changes") return { key: item, icon: Diff, label: "changes" };
  if (item === "tokens") return { key: item, icon: Coins, label: "tokens" };
  if (item === "raw") return { key: item, icon: Terminal, label: settings.rawMode ? "raw on" : "raw off" };
  return null;
}
