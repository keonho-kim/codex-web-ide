import { EditorContent } from "@tiptap/react";
import { Play } from "lucide-react";
import { ComposerMentions } from "./ComposerMentions";
import { MentionSuggestions } from "./MentionSuggestions";
import { useComposer } from "./useComposer";

export function Composer({ sessionId, running = false }: { sessionId?: string; running?: boolean }) {
  const composer = useComposer(sessionId);

  return (
    <div className="relative" onKeyDown={composer.onKeyDown}>
      <ComposerMentions mentions={composer.selectedMentions} onRemove={composer.removeMention} />
      <div className="relative">
        {!composer.draft ? <span className="pointer-events-none absolute top-2 left-2.5 text-sm text-muted">Ask Codex. Use @ for files and $ for skills.</span> : null}
        <EditorContent editor={composer.editor} />
        <button
          className="absolute right-2 bottom-2 inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!sessionId || running || !composer.draft.trim() || composer.runPending}
          onClick={composer.runCodex}
        >
          <Play size={15} />
          Run
        </button>
        {running || composer.runPending ? (
          <button
            className="absolute right-[76px] bottom-2 inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={composer.cancelPending}
            onClick={composer.cancelCodex}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <MentionSuggestions mentionSearch={composer.mentionSearch} suggestions={composer.suggestions} onSelect={composer.addMention} />
    </div>
  );
}
