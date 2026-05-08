import { Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ServiceToolbar({
  command,
  startDisabled,
  onCommandChange,
  onRefresh,
  onStart,
}: {
  command: string;
  startDisabled: boolean;
  onCommandChange(value: string): void;
  onRefresh(): void;
  onStart(): void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="w-[min(520px,100%)] min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
        value={command}
        onChange={(event) => onCommandChange(event.target.value)}
      />
      <Button type="button" disabled={startDisabled} onClick={onStart} variant="outline" size="icon-sm">
        <Play data-icon="inline-start" />
      </Button>
      <Button type="button" onClick={onRefresh} variant="outline" size="icon-sm">
        <RefreshCw data-icon="inline-start" />
      </Button>
    </div>
  );
}
