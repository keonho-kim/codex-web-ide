import { FileCode2, Trash2 } from "lucide-react";
import { iconButtonClass, mutedClass, selectedListButtonClass, transparentListButtonClass } from "../../components/uiClasses";
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
    <nav className="grid gap-1">
      {sessions.map((session) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1" key={session.id}>
          <button
            className={`${transparentListButtonClass} ${session.id === activeId ? selectedListButtonClass : ""}`}
            type="button"
            onClick={() => onSelect(session.id)}
          >
            <FileCode2 size={15} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{session.name}</span>
          </button>
          <button className={iconButtonClass} title="Delete session" type="button" onClick={() => onDelete(session.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {sessions.length === 0 ? <p className={mutedClass}>Create a session to browse files.</p> : null}
    </nav>
  );
}
