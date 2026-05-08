import { Folder } from "lucide-react";
import { mutedClass, selectedListButtonClass, transparentListButtonClass } from "../../components/uiClasses";
import type { Project } from "../../lib/types";

export function ProjectList({ projects, activeId, onSelect }: { projects: Project[]; activeId?: string; onSelect(id: string): void }) {
  return (
    <nav className="grid gap-1">
      {projects.map((project) => (
        <button
          className={`${transparentListButtonClass} ${project.id === activeId ? selectedListButtonClass : ""}`}
          key={project.id}
          type="button"
          onClick={() => onSelect(project.id)}
        >
          <Folder size={15} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
        </button>
      ))}
      {projects.length === 0 ? <p className={mutedClass}>Add a local project path.</p> : null}
    </nav>
  );
}
