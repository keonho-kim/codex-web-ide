import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "../../lib/api";
import type { Project } from "../../lib/types";

export function ProjectCreator({ onCreated }: { onCreated(project: Project): void }) {
  const queryClient = useQueryClient();
  const [cwd, setCwd] = useState("");
  const createProject = useMutation({
    mutationFn: (body: { cwd: string }) => api<Project>("/api/projects", { method: "POST", body }),
    onSuccess: async (project) => {
      onCreated(project);
      setCwd("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (cwd.trim()) createProject.mutate({ cwd: cwd.trim() });
      }}
    >
      <input
        className="w-[260px] min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
        value={cwd}
        onChange={(event) => setCwd(event.target.value)}
        placeholder="Project path"
      />
      <button
        className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
        title="Add project"
        type="submit"
      >
        <Plus size={16} />
      </button>
    </form>
  );
}
