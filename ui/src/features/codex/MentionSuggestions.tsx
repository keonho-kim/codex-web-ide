import { cn } from "../../lib/classes";
import type { ComposerMention, MentionPopupState } from "../../lib/types";
import { mentionKey, mentionLabel } from "./mentionUtils";

export function MentionSuggestions({
  mentionSearch,
  suggestions,
  onSelect,
}: {
  mentionSearch: MentionPopupState | null;
  suggestions: ComposerMention[];
  onSelect(mention: ComposerMention): void;
}) {
  if (!mentionSearch || suggestions.length === 0) return null;
  return (
    <div className="absolute right-0 bottom-24 left-0 max-h-[180px] overflow-auto rounded-md bg-ink p-2 text-[11px] text-white">
      {suggestions.map((mention, index) => (
        <button
          className={cn(
            "inline-flex min-h-7 w-full items-center justify-start gap-1.5 overflow-hidden rounded-md border border-transparent bg-transparent px-2.5 py-1 text-left text-sm text-white",
            index === mentionSearch.selectedIndex && "border-selected-border bg-selected text-primary",
          )}
          key={mentionKey(mention)}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(mention);
          }}
        >
          {mentionLabel(mention)}
        </button>
      ))}
    </div>
  );
}
