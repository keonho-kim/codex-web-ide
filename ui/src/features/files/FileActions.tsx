import { FilePlus2, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          className="compact-input flex-1"
          value={files.pathInput}
          onChange={(event) => files.setPathInput(event.target.value)}
          placeholder="path/to/file.ts"
        />
        <Button title="Create file" type="submit" disabled={!sessionId || !files.trimmedPath || files.pending} variant="outline" size="icon-xs">
          <FilePlus2 data-icon="inline-start" />
        </Button>
        <Button
          title="Create folder"
          type="button"
          disabled={!sessionId || !files.trimmedPath || files.pending}
          onClick={files.actions.createDirectory}
          variant="outline"
          size="icon-xs"
        >
          <FolderPlus data-icon="inline-start" />
        </Button>
        <Button
          title="Rename selected file"
          type="button"
          disabled={!sessionId || !files.activeFilePath || !files.trimmedPath || files.activeFilePath === files.trimmedPath || files.pending}
          onClick={files.actions.renameFile}
          variant="outline"
          size="icon-xs"
        >
          <Pencil data-icon="inline-start" />
        </Button>
        <Button
          title="Delete path"
          type="button"
          disabled={!sessionId || !files.operationPath || files.pending}
          onClick={() => {
            if (files.operationPath && confirm(`Delete ${files.operationPath}?`)) files.actions.deleteFile();
          }}
          variant="outline"
          size="icon-xs"
        >
          <Trash2 data-icon="inline-start" />
        </Button>
      </div>
      {files.error ? <p className="error-text m-0">{files.error instanceof Error ? files.error.message : "File operation failed."}</p> : null}
    </form>
  );
}
