import type { ComposerMention } from "../../lib/types";
import { mentionKey, mentionLabel } from "./mentionUtils";

export function ComposerMentions({ mentions, onRemove }: { mentions: ComposerMention[]; onRemove(mention: ComposerMention): void }) {
  return (
    <div className="mb-1 flex flex-wrap gap-1">
      {mentions.map((mention) => (
        <button
          className="inline-flex min-h-6 items-center rounded-md border border-control bg-canvas px-2 py-0.5 text-xs text-primary"
          key={mentionKey(mention)}
          type="button"
          onClick={() => onRemove(mention)}
        >
          {mentionLabel(mention)}
        </button>
      ))}
    </div>
  );
}
