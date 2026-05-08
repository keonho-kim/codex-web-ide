import { Folder } from "lucide-react";
import { cn } from "../../lib/classes";
import type { Project } from "../../lib/types";

export function ProjectList({ projects, activeId, onSelect }: { projects: Project[]; activeId?: string; onSelect(id: string): void }) {
  return (
    <nav className="grid gap-1">
      {projects.map((project) => (
        <button
          className={cn(
            "inline-flex min-h-7 w-full items-center justify-start gap-1.5 overflow-hidden rounded-md border border-transparent bg-transparent px-2.5 py-1 text-left text-sm text-ink",
            project.id === activeId && "border-selected-border bg-selected text-primary",
          )}
          key={project.id}
          type="button"
          onClick={() => onSelect(project.id)}
        >
          <Folder size={15} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
        </button>
      ))}
      {projects.length === 0 ? <p className="text-xs text-muted">Add a local project path.</p> : null}
    </nav>
  );
}
