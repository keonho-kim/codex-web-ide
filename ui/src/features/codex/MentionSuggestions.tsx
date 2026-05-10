import { useEffect, useRef } from "react";
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
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    itemRefs.current[mentionSearch?.selectedIndex ?? -1]?.scrollIntoView({ block: "nearest" });
  }, [mentionSearch?.selectedIndex]);

  if (!mentionSearch || suggestions.length === 0) return null;
  return (
    <div className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-[220px] overflow-auto rounded-md border border-control bg-panel p-1 text-[11px] text-ink shadow-lg" data-testid="mention-suggestions">
      {suggestions.map((mention, index) => (
        <button
          className={cn(
            "inline-flex min-h-8 w-full items-center justify-start gap-1.5 overflow-hidden rounded-md border border-transparent bg-transparent px-2.5 py-1 text-left text-sm text-ink",
            index === mentionSearch.selectedIndex && "border-selected-border bg-selected text-primary",
          )}
          key={mentionKey(mention)}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
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
