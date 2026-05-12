import { FileCode2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/classes";
import type { Session } from "@/lib/types";

export function SessionList({
  sessions,
  activeId,
  onSelect,
  onDelete,
}: {
  sessions: Session[];
  activeId?: string;
  onSelect(id: string): void;
  onDelete(id: string): void;
}) {
  return (
    <nav className="grid gap-1">
      {sessions.map((session) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1" key={session.id}>
          <button
            className={cn(
              "inline-flex min-h-7 w-full items-center justify-start gap-1.5 overflow-hidden rounded-md border border-transparent bg-transparent px-2.5 py-1 text-left text-sm text-ink hover:bg-page",
              session.id === activeId && "border-selected-border bg-selected text-primary",
            )}
            type="button"
            onClick={() => onSelect(session.id)}
          >
            <FileCode2 size={15} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{session.name}</span>
          </button>
          <Button title="Delete session" type="button" onClick={() => onDelete(session.id)} variant="outline" size="icon-xs">
            <Trash2 data-icon="inline-start" />
          </Button>
        </div>
      ))}
      {sessions.length === 0 ? <p className="text-xs text-muted">Create a session to browse files.</p> : null}
    </nav>
  );
}
