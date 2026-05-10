import { EditorContent } from "@tiptap/react";
import { ArrowUp, CircleStop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/classes";
import { useUiStore } from "../../store/uiStore";
import { CodexStatusLine } from "./CodexStatusLine";
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
  const isBusy = running || composer.runPending;
  const canStart = Boolean((sessionId || activeProjectId) && composer.draft.trim() && !isBusy);

  return (
    <div className="relative" onKeyDownCapture={(event) => composer.onKeyDown(event, isBusy)}>
      <div className="relative overflow-hidden rounded-lg border border-control bg-canvas shadow-sm transition-colors focus-within:border-primary" data-testid="composer-input">
        <CodexStatusLine running={isBusy} sessionId={sessionId} />
        <ComposerMentions mentions={composer.selectedMentions} onRemove={composer.removeMention} />
        {!composer.draft ? (
          <span className={cn("pointer-events-none absolute left-3 text-sm text-muted", composer.selectedMentions.length > 0 ? "top-24" : "top-[58px]")}>
            Ask Codex. Use @ for files and $ for skills.
          </span>
        ) : null}
        <EditorContent editor={composer.editor} />
        <div className="flex min-h-12 items-center justify-between gap-2 border-t border-hairline bg-panel/60 px-2.5 py-1.5 max-[700px]:flex-col max-[700px]:items-stretch">
          <ComposerHint />
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

function ComposerHint() {
  const rawMode = useUiStore((state) => state.codexCommandSettings.rawMode);
  return <span className="truncate text-[11px] text-muted max-[700px]:whitespace-normal">{rawMode ? "Raw mode keeps input unchanged." : "Enter sends one line. Ctrl+Enter inserts a line."}</span>;
}
