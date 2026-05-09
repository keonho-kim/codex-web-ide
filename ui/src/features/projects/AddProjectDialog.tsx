import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, FileText, Folder, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import type { LocalPathListing, Project, Session } from "../../lib/types";

export function AddProjectDialog({
  compact = false,
  defaultProjectsDir,
  onProjectSelect,
  onSessionSelect,
  sessions,
}: {
  compact?: boolean;
  defaultProjectsDir?: string;
  onProjectSelect(id: string): void;
  onSessionSelect(id: string): void;
  sessions: Session[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cwd, setCwd] = useState("");
  const [browsePath, setBrowsePath] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const listing = useQuery({
    queryKey: ["project-browse", browsePath],
    queryFn: () => api<LocalPathListing>(`/api/projects/browse?path=${encodeURIComponent(browsePath)}`),
    enabled: open && Boolean(browsePath),
  });
  const createFolder = useMutation({
    mutationFn: () => api<LocalPathListing>("/api/projects/browse/folder", { method: "POST", body: { path: listing.data?.path, name: newFolderName.trim() } }),
    onSuccess: async (next) => {
      setCwd(next.path);
      setBrowsePath(next.path);
      setNewFolderName("");
      await queryClient.invalidateQueries({ queryKey: ["project-browse"] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const startPath = defaultProjectsDir ?? "";
    setCwd(startPath);
    setBrowsePath(startPath);
    setNewFolderName("");
    setError(undefined);
  }, [defaultProjectsDir, open]);

  const addProject = async () => {
    const path = cwd.trim();
    if (!path) return;
    setPending(true);
    setError(undefined);
    try {
      const project = await api<Project>("/api/projects", { method: "POST", body: { cwd: path } });
      const session = findProjectSession(project, sessions) ?? (await api<Session>("/api/sessions", { method: "POST", body: { projectId: project.id } }));
      onProjectSelect(project.id);
      onSessionSelect(session.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
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
        <Button aria-label="Add project" className="justify-start text-muted" title="Add project" type="button" variant="ghost" size={compact ? "icon-sm" : "sm"}>
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
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[700px]:grid-cols-1">
            <input
              className="min-w-0 rounded-md border border-control bg-canvas px-3 py-2 font-mono text-sm text-ink"
              value={cwd}
              onChange={(event) => setCwd(event.target.value)}
              placeholder={defaultProjectsDir || "Project path"}
            />
            <Button type="button" variant="outline" onClick={() => setBrowsePath(cwd.trim())} disabled={!cwd.trim()}>
              Browse
            </Button>
          </div>
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
                  setCwd(listing.data.parentPath);
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
                    setCwd(entry.path);
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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[700px]:grid-cols-1">
              <input
                className="min-w-0 rounded-md border border-control bg-canvas px-3 py-2 text-sm text-ink"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="New folder name"
              />
              <Button type="button" variant="outline" disabled={!listing.data?.path || !newFolderName.trim() || createFolder.isPending} onClick={() => createFolder.mutate()}>
                <FolderPlus data-icon="inline-start" />
                New folder
              </Button>
            </div>
            {createFolder.error ? <p className="m-0 text-sm text-destructive">{createFolder.error instanceof Error ? createFolder.error.message : "Unable to create folder."}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button disabled={!cwd.trim() || pending} type="submit">
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

function findProjectSession(project: Project, sessions: Session[]) {
  return sessions
    .filter((session) => session.projectId === project.id || session.cwd === project.cwd || session.cwd.startsWith(`${project.cwd.replace(/\/+$/, "")}/`))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
}
