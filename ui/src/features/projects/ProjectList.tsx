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
    <nav className="grid gap-1">
      {projects.map((project) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1" key={project.id}>
          <button
            className={cn(
              "inline-flex min-h-7 w-full items-center justify-start gap-1.5 overflow-hidden rounded-md border border-transparent bg-transparent px-2.5 py-1 text-left text-sm text-ink hover:bg-page",
              project.id === activeId && "border-selected-border bg-selected text-primary",
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
      {projects.length === 0 ? <p className="text-xs text-muted">Add a local project path.</p> : null}
    </nav>
  );
}
