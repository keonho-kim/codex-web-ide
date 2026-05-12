import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

export function ProjectCreator({ defaultProjectsDir, onCreated }: { defaultProjectsDir?: string; onCreated(project: Project): void }) {
  const queryClient = useQueryClient();
  const [cwd, setCwd] = useState("");

  useEffect(() => {
    if (!cwd && defaultProjectsDir) setCwd(defaultProjectsDir);
  }, [cwd, defaultProjectsDir]);

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
        placeholder={defaultProjectsDir || "Project path"}
      />
      <Button title="Add project" type="submit" variant="outline" size="icon-sm">
        <Plus data-icon="inline-start" />
      </Button>
    </form>
  );
}
