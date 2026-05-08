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
    <div className="mention-popover">
      {suggestions.map((mention, index) => (
        <button
          className={cn(
            "mention-option",
            index === mentionSearch.selectedIndex && "panel-tab-selected",
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
