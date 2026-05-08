import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { iconButtonClass, inputClass, mutedClass } from "../../components/uiClasses";
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
          className={`${inputClass} h-7 min-w-0 flex-1 py-1 text-xs`}
          value={defaultProjectsDir}
          onChange={(event) => setDefaultProjectsDir(event.target.value)}
          placeholder="Default project directory"
        />
        <button className={iconButtonClass} title="Save workspace settings" type="submit" disabled={!settings || !defaultProjectsDir.trim() || pending}>
          <Save size={14} />
        </button>
      </div>
      <p className={mutedClass}>Recent projects: {settings?.recentProjectIds.length ?? 0}</p>
    </form>
  );
}
