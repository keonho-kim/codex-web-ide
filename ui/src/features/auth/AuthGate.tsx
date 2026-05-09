import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCsrfToken } from "../../lib/api";

type AuthStatus = {
  enabled: boolean;
  authenticated: boolean;
  provider: "telegram";
  csrfToken?: string;
};

type LoginRequest = {
  requestId: string;
  code: string;
  expiresAt: number;
};

type LoginState = "idle" | "pending" | "approved" | "error";

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>();
  const [request, setRequest] = useState<LoginRequest>();
  const [state, setState] = useState<LoginState>("idle");
  const [error, setError] = useState<string>();
  const [csrf, setCsrf] = useState<string>();

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (!status?.authenticated || !status.enabled) return;
    const heartbeat = setInterval(() => {
      void fetch("/api/auth/heartbeat", { method: "POST", credentials: "same-origin", headers: csrf ? { "X-CSRF-Token": csrf } : undefined }).catch(() => undefined);
    }, 15000);
    return () => clearInterval(heartbeat);
  }, [csrf, status?.authenticated, status?.enabled]);

  useEffect(() => {
    if (!request || state !== "pending") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/auth/login/${request.requestId}/status`, { credentials: "same-origin" });
      const body = (await response.json()) as { status: string; completeToken?: string };
      if (body.status === "approved" && body.completeToken) {
        setState("approved");
        const complete = await fetch(`/api/auth/login/${request.requestId}/complete`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completeToken: body.completeToken }),
        });
        if (!complete.ok) throw new Error("Login completion failed.");
        const completed = (await complete.json()) as { csrfToken?: string };
        setCsrfToken(completed.csrfToken);
        setCsrf(completed.csrfToken);
        await refreshStatus();
      }
      if (body.status === "denied" || body.status === "expired") {
        setState("error");
        setError(`Login ${body.status}.`);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [request, state]);

  async function refreshStatus() {
    const response = await fetch("/api/auth/status", { credentials: "same-origin" });
    const body = (await response.json()) as AuthStatus;
    setCsrfToken(body.csrfToken);
    setCsrf(body.csrfToken);
    setStatus(body);
  }

  async function requestLogin() {
    setError(undefined);
    setState("pending");
    const response = await fetch("/api/auth/login/request", { method: "POST", credentials: "same-origin" });
    if (!response.ok) {
      setState("error");
      setError(await response.text());
      return;
    }
    setRequest((await response.json()) as LoginRequest);
  }

  if (!status) return <div className="flex h-screen items-center justify-center bg-page text-sm text-muted">Loading authentication.</div>;
  if (!status.enabled || status.authenticated) return <>{children}</>;

  return (
    <main className="flex h-screen items-center justify-center bg-page p-6 text-ink">
      <section className="w-full max-w-sm rounded-lg border border-hairline bg-canvas p-5 shadow-sm">
        <ShieldCheck className="mb-4 text-primary" size={28} />
        <h1 className="text-lg font-semibold">Telegram approval required</h1>
        <p className="mt-2 text-sm text-muted">Approve this browser session from the configured Telegram bot.</p>
        {request ? (
          <div className="mt-4 rounded-md border border-hairline bg-panel p-3">
            <p className="text-xs text-muted">Login code</p>
            <p className="mt-1 font-mono text-2xl tracking-normal">{request.code}</p>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        <Button className="mt-4 w-full" type="button" disabled={state === "pending"} onClick={requestLogin}>
          {state === "pending" ? "Waiting for approval" : "Request approval"}
        </Button>
      </section>
    </main>
  );
}
