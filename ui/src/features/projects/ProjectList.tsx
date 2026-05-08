import { Folder } from "lucide-react";
import { cn } from "../../lib/classes";
import type { Project } from "../../lib/types";

export function ProjectList({ projects, activeId, onSelect }: { projects: Project[]; activeId?: string; onSelect(id: string): void }) {
  return (
    <nav className="nav-list">
      {projects.map((project) => (
        <button
          className={cn(
            "nav-item",
            project.id === activeId && "nav-item-selected",
          )}
          key={project.id}
          type="button"
          onClick={() => onSelect(project.id)}
        >
          <Folder size={15} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
        </button>
      ))}
      {projects.length === 0 ? <p className="empty-state">Add a local project path.</p> : null}
    </nav>
  );
}
