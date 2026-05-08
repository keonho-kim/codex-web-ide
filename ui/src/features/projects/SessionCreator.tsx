import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { api } from "../../lib/api";
import type { Session } from "../../lib/types";

export function SessionCreator({ projectId, onCreated }: { projectId?: string; onCreated(session: Session): void }) {
  const queryClient = useQueryClient();
  const createSession = useMutation({
    mutationFn: () => api<Session>("/api/sessions", { method: "POST", body: { projectId } }),
    onSuccess: async (session) => {
      onCreated(session);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
  return (
    <button
      className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
      title="Create session"
      type="button"
      onClick={() => createSession.mutate()}
      disabled={!projectId}
    >
      <Play size={16} />
      Session
    </button>
  );
}
