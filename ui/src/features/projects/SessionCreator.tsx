import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";

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
    <Button
      title="Create session"
      type="button"
      onClick={() => createSession.mutate()}
      disabled={!projectId}
      variant="outline"
      size="sm"
    >
      <Play data-icon="inline-start" />
      Session
    </Button>
  );
}
