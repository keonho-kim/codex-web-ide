import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buttonClass, inputClass } from "../../components/uiClasses";
import { api } from "../../lib/api";

type AuthStatus = {
  enabled: boolean;
  authenticated: boolean;
};

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const status = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => api<AuthStatus>("/api/auth/status"),
  });
  const login = useMutation({
    mutationFn: () => api("/api/auth/login", { method: "POST", body: { token } }),
    onSuccess: async () => {
      setToken("");
      await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    },
  });

  if (status.isLoading) return <main className="h-screen bg-page" />;
  if (!status.data?.enabled || status.data.authenticated) return children;

  return (
    <main className="flex h-screen items-center justify-center bg-page p-6 text-ink">
      <form
        className="grid w-full max-w-sm gap-3 rounded-md border border-hairline bg-canvas p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (token.trim()) login.mutate();
        }}
      >
        <h1 className="text-base font-semibold">Codex Web IDE</h1>
        <input className={inputClass} value={token} onChange={(event) => setToken(event.target.value)} placeholder="Auth token" type="password" autoFocus />
        <button className={buttonClass} type="submit" disabled={!token.trim() || login.isPending}>
          Unlock
        </button>
        {login.isError ? <p className="text-xs text-red-600">Invalid token.</p> : null}
      </form>
    </main>
  );
}
