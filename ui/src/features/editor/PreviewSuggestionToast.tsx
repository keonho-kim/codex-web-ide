import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PreviewSuggestionToast({
  commandLabel,
  disabled,
  onDismiss,
  onNo,
  onYes,
}: {
  commandLabel: string;
  disabled?: boolean;
  onDismiss(): void;
  onNo(): void;
  onYes(): void;
}) {
  return (
    <div className="absolute bottom-4 right-4 z-20 w-[min(360px,calc(100%-32px))] rounded-lg border border-hairline bg-panel p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Open preview for this workspace?</p>
          <p className="mt-1 truncate font-mono text-xs text-muted">{commandLabel}</p>
        </div>
        <button className="rounded-md p-1 text-muted hover:bg-page hover:text-ink" aria-label="Dismiss preview suggestion" type="button" onClick={onDismiss}>
          <X size={14} />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onNo}>
          No
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onYes}>
          <Play data-icon="inline-start" />
          Yes
        </Button>
      </div>
    </div>
  );
}
