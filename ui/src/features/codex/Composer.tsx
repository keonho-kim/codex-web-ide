import { EditorContent } from "@tiptap/react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComposerMentions } from "./ComposerMentions";
import { MentionSuggestions } from "./MentionSuggestions";
import { SlashCommandDialog } from "./SlashCommandDialog";
import { SlashCommandSuggestions } from "./SlashCommandSuggestions";
import { useComposer } from "./useComposer";

export function Composer({ sessionId, running = false }: { sessionId?: string; running?: boolean }) {
  const composer = useComposer(sessionId);
  const isBusy = running || composer.runPending;

  return (
    <div className="relative" onKeyDownCapture={(event) => composer.onKeyDown(event, isBusy)}>
      <ComposerMentions mentions={composer.selectedMentions} onRemove={composer.removeMention} />
      <div className="relative overflow-hidden rounded-md border border-control bg-canvas transition-colors focus-within:border-primary">
        {!composer.draft ? <span className="pointer-events-none absolute top-2 left-2.5 text-sm text-muted">Ask Codex. Use @ for files and $ for skills.</span> : null}
        <EditorContent editor={composer.editor} />
        <div className="flex min-h-11 items-center justify-between gap-2 border-t border-hairline px-2 py-1.5">
          <span className="truncate text-[11px] text-muted">Enter sends one line. Ctrl+Enter inserts a line.</span>
          <div className="flex shrink-0 items-center gap-2">
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
      <MentionSuggestions mentionSearch={composer.mentionSearch} suggestions={composer.suggestions} onSelect={composer.addMention} />
      <SlashCommandSuggestions commands={composer.slashSuggestions} selectedIndex={composer.selectedSlashIndex} onSelect={composer.selectSlashCommand} />
      <SlashCommandDialog command={composer.activeSlashCommand} open={composer.slashDialogOpen} onOpenChange={composer.setSlashDialogOpen} onApply={composer.applySlashCommand} />
    </div>
  );
}
