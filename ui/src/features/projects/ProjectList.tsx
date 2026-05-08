import { Folder, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/classes";
import type { Project } from "../../lib/types";

export function ProjectList({
  projects,
  activeId,
  onDelete,
  onSelect,
}: {
  projects: Project[];
  activeId?: string;
  onDelete(id: string): void;
  onSelect(id: string): void;
}) {
  return (
    <nav className="nav-list">
      {projects.map((project) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1" key={project.id}>
          <button
            className={cn(
              "nav-item",
              project.id === activeId && "nav-item-selected",
            )}
            type="button"
            onClick={() => onSelect(project.id)}
          >
            <Folder size={15} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
          </button>
          <Button title="Remove project" type="button" onClick={() => onDelete(project.id)} variant="outline" size="icon-xs">
            <Trash2 data-icon="inline-start" />
          </Button>
        </div>
      ))}
      {projects.length === 0 ? <p className="empty-state">Add a local project path.</p> : null}
    </nav>
  );
}
