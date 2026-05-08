import { FileCode2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/classes";
import type { Session } from "../../lib/types";

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
    <nav className="nav-list">
      {sessions.map((session) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1" key={session.id}>
          <button
            className={cn(
              "nav-item",
              session.id === activeId && "nav-item-selected",
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
      {sessions.length === 0 ? <p className="empty-state">Create a session to browse files.</p> : null}
    </nav>
  );
}
