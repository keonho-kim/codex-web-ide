import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { WorkspaceSettings } from "../../lib/types";

export function WorkspaceSettingsPanel({
  settings,
  onSave,
  pending = false,
}: {
  settings?: WorkspaceSettings;
  onSave(settings: WorkspaceSettings): void;
  pending?: boolean;
}) {
  const [defaultProjectsDir, setDefaultProjectsDir] = useState("");

  useEffect(() => {
    setDefaultProjectsDir(settings?.defaultProjectsDir ?? "");
  }, [settings?.defaultProjectsDir]);

  return (
    <form
      className="grid gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (settings && defaultProjectsDir.trim()) onSave({ ...settings, defaultProjectsDir: defaultProjectsDir.trim() });
      }}
    >
      <div className="flex min-w-0 items-center gap-1">
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2.5 py-1 text-xs text-ink"
          value={defaultProjectsDir}
          onChange={(event) => setDefaultProjectsDir(event.target.value)}
          placeholder="Default project directory"
        />
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Save workspace settings"
          type="submit"
          disabled={!settings || !defaultProjectsDir.trim() || pending}
        >
          <Save size={14} />
        </button>
      </div>
      <p className="text-xs text-muted">Recent projects: {settings?.recentProjectIds.length ?? 0}</p>
    </form>
  );
}
