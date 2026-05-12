import type { ComposerMention } from "@/lib/types";
import { mentionKey, mentionLabel } from "@/features/codex/mentionUtils";

export function ComposerMentions({ mentions, onRemove }: { mentions: ComposerMention[]; onRemove(mention: ComposerMention): void }) {
  if (mentions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 border-b border-hairline bg-panel/50 px-2.5 py-2" data-testid="composer-mentions">
      {mentions.map((mention) => (
        <button
          className="inline-flex min-h-6 max-w-full items-center rounded-md border border-control bg-canvas px-2 py-0.5 text-xs text-primary"
          key={mentionKey(mention)}
          type="button"
          onClick={() => onRemove(mention)}
        >
          <span className="truncate">{mentionLabel(mention)}</span>
        </button>
      ))}
    </div>
  );
}
