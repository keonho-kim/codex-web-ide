import { FilePlus2, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useFileActions } from "./useFileActions";

export function FileActions({ sessionId }: { sessionId?: string }) {
  const files = useFileActions(sessionId);

  return (
    <form
      className="grid gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (sessionId && files.trimmedPath) files.actions.createFile();
      }}
    >
      <div className="flex min-w-0 items-center gap-1">
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2.5 py-1 text-xs text-ink"
          value={files.pathInput}
          onChange={(event) => files.setPathInput(event.target.value)}
          placeholder="path/to/file.ts"
        />
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Create file"
          type="submit"
          disabled={!sessionId || !files.trimmedPath || files.pending}
        >
          <FilePlus2 size={14} />
        </button>
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Create folder"
          type="button"
          disabled={!sessionId || !files.trimmedPath || files.pending}
          onClick={files.actions.createDirectory}
        >
          <FolderPlus size={14} />
        </button>
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Rename selected file"
          type="button"
          disabled={!sessionId || !files.activeFilePath || !files.trimmedPath || files.activeFilePath === files.trimmedPath || files.pending}
          onClick={files.actions.renameFile}
        >
          <Pencil size={14} />
        </button>
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Delete path"
          type="button"
          disabled={!sessionId || !files.operationPath || files.pending}
          onClick={() => {
            if (files.operationPath && confirm(`Delete ${files.operationPath}?`)) files.actions.deleteFile();
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {files.error ? <p className="m-0 text-xs text-red-600">{files.error instanceof Error ? files.error.message : "File operation failed."}</p> : null}
    </form>
  );
}
