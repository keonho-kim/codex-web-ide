import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, FileText, Folder, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import type { LocalPathListing, Project } from "../../lib/types";

const DEFAULT_BROWSE_PATH = "~";

export function AddProjectDialog({
  compact = false,
  defaultProjectsDir,
  onProjectSelect,
}: {
  compact?: boolean;
  defaultProjectsDir?: string;
  onProjectSelect(id: string): void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const listing = useQuery({
    queryKey: ["project-browse", browsePath],
    queryFn: () => api<LocalPathListing>(`/api/projects/browse?path=${encodeURIComponent(browsePath)}`),
    enabled: open && Boolean(browsePath),
  });

  useEffect(() => {
    if (!open) return;
    const startPath = defaultProjectsDir?.trim() || DEFAULT_BROWSE_PATH;
    setBrowsePath(startPath);
    setError(undefined);
  }, [defaultProjectsDir, open]);

  const addProject = async () => {
    const path = listing.data?.path ?? browsePath;
    if (!path) return;
    setPending(true);
    setError(undefined);
    try {
      const project = await api<Project>("/api/projects", { method: "POST", body: { cwd: path } });
      onProjectSelect(project.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-settings"] }),
      ]);
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to add project.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button aria-label="Add project" className={cn(compact ? "justify-center" : "justify-start", "text-muted")} title="Add project" type="button" variant="ghost" size={compact ? "icon-sm" : "sm"}>
          <FolderPlus data-icon="inline-start" />
          {!compact ? "Add project" : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
          <DialogDescription>Choose a local repository or project folder that contains code for this project.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void addProject();
          }}
        >
          <div className="grid gap-2 rounded-md border border-hairline bg-panel p-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate font-mono text-xs text-muted">{listing.data?.path ?? browsePath}</span>
              <Button
                title="Parent folder"
                type="button"
                variant="outline"
                size="icon-xs"
                disabled={!listing.data?.parentPath}
                onClick={() => {
                  if (!listing.data?.parentPath) return;
                  setBrowsePath(listing.data.parentPath);
                }}
              >
                <ArrowUp data-icon="inline-start" />
              </Button>
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-hairline bg-canvas">
              {listing.data?.entries.map((entry) => (
                <button
                  className={cn(
                    "grid min-h-9 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left text-sm",
                    entry.isDirectory ? "text-ink hover:bg-page" : "cursor-default text-muted",
                  )}
                  disabled={!entry.isDirectory}
                  key={entry.path}
                  type="button"
                  onClick={() => {
                    if (!entry.isDirectory) return;
                    setBrowsePath(entry.path);
                  }}
                >
                  {entry.isDirectory ? <Folder size={15} /> : <FileText size={15} />}
                  <span className="truncate">{entry.name}</span>
                  {!entry.isDirectory ? <span className="text-[11px] text-muted">file</span> : null}
                </button>
              ))}
              {listing.isLoading ? <p className="m-0 px-3 py-4 text-sm text-muted">Loading folder.</p> : null}
              {listing.error ? <p className="m-0 px-3 py-4 text-sm text-destructive">{listing.error instanceof Error ? listing.error.message : "Unable to browse this path."}</p> : null}
              {listing.data?.entries.length === 0 ? <p className="m-0 px-3 py-4 text-sm text-muted">This folder is empty.</p> : null}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button disabled={!listing.data?.path || pending || listing.isLoading} type="submit">
              <FolderPlus data-icon="inline-start" />
              Add project
            </Button>
          </div>
          {error ? <p className="m-0 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
