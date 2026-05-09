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

  return (
    <div className="relative" onKeyDown={composer.onKeyDown}>
      <ComposerMentions mentions={composer.selectedMentions} onRemove={composer.removeMention} />
      <div className="relative">
        {!composer.draft ? <span className="pointer-events-none absolute top-2 left-2.5 text-sm text-muted">Ask Codex. Use @ for files and $ for skills.</span> : null}
        <EditorContent editor={composer.editor} />
        <Button
          className="absolute right-2 bottom-2"
          variant="outline"
          size="sm"
          type="button"
          disabled={!sessionId || running || !composer.draft.trim() || composer.runPending}
          onClick={composer.runCodex}
        >
          <Play data-icon="inline-start" />
          Run
        </Button>
        {running || composer.runPending ? (
          <Button className="absolute right-[76px] bottom-2" variant="outline" size="sm" type="button" disabled={composer.cancelPending} onClick={composer.cancelCodex}>
            Cancel
          </Button>
        ) : null}
      </div>
      {composer.error ? <p className="mt-1 text-xs text-destructive">{composer.error}</p> : null}
      <MentionSuggestions mentionSearch={composer.mentionSearch} suggestions={composer.suggestions} onSelect={composer.addMention} />
      <SlashCommandSuggestions commands={composer.slashSuggestions} selectedIndex={composer.selectedSlashIndex} onSelect={composer.selectSlashCommand} />
      <SlashCommandDialog command={composer.activeSlashCommand} open={composer.slashDialogOpen} onOpenChange={composer.setSlashDialogOpen} onApply={composer.applySlashCommand} />
    </div>
  );
}
