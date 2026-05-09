import { createHash, randomBytes } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import type { JsonStore } from "../managers/storage";
import type { WorkspaceManager } from "../managers/workspaceManager";
import type { WorkspaceSettings } from "../shared/types";
import { AuditLogger } from "./auditLogger";
import { SecretsStore, type AuthSecrets } from "./secretsStore";
import { TelegramClient, telegramDisplayName, type TelegramUpdate } from "./telegramClient";

export type AuthState = {
  enabled: boolean;
  provider: "telegram";
  configured: boolean;
  singleSession: boolean;
};

type LoginRequest = {
  id: string;
  code: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "denied" | "expired";
  replaceCurrent: boolean;
  completeToken?: string;
  completeTokenHash?: string;
};

type ActiveUserSession = {
  id: string;
  ip: string;
  userAgent: string;
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  revokedAt?: number;
};

const LOGIN_REQUEST_LIMIT = 5;
const AUTH_COOKIE = "cw_session";
const CALLBACK_PREFIX = "cw_auth";
const CSRF_HEADER = "x-csrf-token";

export class AuthManager {
  private settings?: WorkspaceSettings;
  private secrets?: AuthSecrets;
  private telegram?: TelegramClient;
  private pollTimer?: ReturnType<typeof setInterval>;
  private telegramOffset?: number;
  private telegramPolling = false;
  private loginRequests = new Map<string, LoginRequest>();
  private activeSession?: ActiveUserSession;
  private forceLoopbackAuth = false;
  private audit: AuditLogger;
  private secretsStore: SecretsStore;

  constructor(
    private workspace: WorkspaceManager,
    store: JsonStore,
  ) {
    this.audit = new AuditLogger(store);
    this.secretsStore = new SecretsStore(store);
  }

  async initialize(required: boolean, explicitAuth?: "enable" | "disable") {
    this.forceLoopbackAuth = process.env.CODEX_WEB_AUTH === "1";
    await this.syncWithSettings(required, explicitAuth);
    this.startTelegramPolling();
    return this.getStatus();
  }

  async syncWithSettings(required: boolean, explicitAuth?: "enable" | "disable") {
    const settings = await this.workspace.getSettings();
    return this.applySettings(settings, required, explicitAuth);
  }

  async applySettings(settings: WorkspaceSettings, required: boolean, explicitAuth?: "enable" | "disable") {
    const enabled = explicitAuth === "disable" ? false : explicitAuth === "enable" || required || settings.auth.enabled;
    const next = {
      ...settings,
      auth: {
        ...settings.auth,
        enabled,
        provider: "telegram" as const,
      },
    };
    this.settings = next;
    this.secrets = await this.secretsStore.read();
    if (enabled) this.requireConfigured(next, this.secrets);
    this.telegram = enabled ? new TelegramClient(this.telegramToken(this.secrets)) : undefined;
    if (!explicitAuth && enabled !== settings.auth.enabled) await this.workspace.updateSettings(next);
    this.startTelegramPolling();
    return this.getStatus();
  }

  async configureTelegram(input: { botToken: string; allowedTelegramUserId: number; allowedChatId: number; ownerDisplayName?: string; botUsername?: string }) {
    await this.secretsStore.update((secrets) => ({
      ...secrets,
      telegram: { botToken: input.botToken },
    }));
    const settings = await this.workspace.getSettings();
    await this.workspace.updateSettings({
      ...settings,
      telegram: {
        allowedTelegramUserId: input.allowedTelegramUserId,
        allowedChatId: input.allowedChatId,
        ownerDisplayName: input.ownerDisplayName,
        botUsername: input.botUsername,
        remoteControlEnabled: settings.telegram?.remoteControlEnabled ?? false,
      },
    });
    await this.syncWithSettings(settings.auth.enabled);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const decision = this.authorizeRequest(req);
      if (!decision.ok) {
        void this.audit.write({ type: decision.auditType, ip: clientAddress(req), userAgent: req.header("user-agent"), detail: { path: req.path } });
        res.status(decision.status).json({ error: decision.message });
        return;
      }
      next();
    };
  }

  securityHeaders() {
    return (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "same-origin");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
      next();
    };
  }

  registerRoutes(app: Express) {
    app.get("/api/auth/status", (req, res) => {
      const session = this.currentSession(req);
      res.json({
        enabled: this.enabled(),
        authenticated: !this.enabled() || Boolean(session),
        provider: "telegram",
        singleSession: this.settings?.auth.singleSession ?? true,
        csrfToken: session?.csrfToken,
      });
    });
    app.post("/api/auth/login/request", async (req, res) => {
      if (!this.enabled()) {
        res.json({ authenticated: true });
        return;
      }
      const request = await this.createLoginRequest(req);
      res.status(201).json({ requestId: request.id, code: request.code, expiresAt: request.expiresAt });
    });
    app.get("/api/auth/login/:requestId/status", (req, res) => {
      const request = this.getLoginRequest(req.params.requestId);
      res.json(request.status === "approved" ? { status: request.status, completeToken: request.completeToken } : { status: request.status });
    });
    app.post("/api/auth/login/:requestId/complete", async (req, res) => {
      const request = this.getLoginRequest(req.params.requestId);
      const completeToken = typeof req.body?.completeToken === "string" ? req.body.completeToken : "";
      if (request.status !== "approved" || !request.completeTokenHash || sha256(completeToken) !== request.completeTokenHash) {
        await this.audit.write({ type: "auth.failed", ip: clientAddress(req), userAgent: req.header("user-agent"), detail: { reason: "invalid-complete-token" } });
        res.status(401).json({ error: "Login approval is not complete." });
        return;
      }
      const session = this.createActiveSession(req);
      this.loginRequests.delete(request.id);
      setSessionCookie(req, res, session.id);
      await this.audit.write({ type: "auth.login.completed", ip: session.ip, userAgent: session.userAgent });
      res.json({ ok: true, csrfToken: session.csrfToken });
    });
    app.post("/api/auth/logout", async (req, res) => {
      const session = this.currentSession(req);
      if (session) session.revokedAt = Date.now();
      res.clearCookie(AUTH_COOKIE, { path: "/" });
      await this.audit.write({ type: "auth.logout", ip: clientAddress(req), userAgent: req.header("user-agent") });
      res.json({ ok: true });
    });
    app.post("/api/auth/heartbeat", (req, res) => {
      const session = this.currentSession(req);
      if (!session) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      session.lastSeenAt = Date.now();
      res.json({ ok: true, expiresAt: session.expiresAt });
    });
  }

  getStatus(): AuthState {
    return {
      enabled: this.enabled(),
      provider: "telegram",
      configured: Boolean(this.settings?.telegram?.allowedChatId && this.telegramToken(this.secrets)),
      singleSession: this.settings?.auth.singleSession ?? true,
    };
  }

  isAuthorizedHeaders(headers: Headers, url: URL, remoteAddress?: string) {
    if (!this.enabled() || publicAssetRequest(url.pathname)) return true;
    if (this.isPublicPath(url.pathname)) return true;
    if (!this.validOriginHeaders(headers, url.host, remoteAddress)) return false;
    const sessionId = parseCookie(headers.get("cookie") || "")[AUTH_COOKIE];
    return Boolean(sessionId && this.validSessionId(sessionId));
  }

  shutdown() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  private authorizeRequest(req: Request): { ok: true } | { ok: false; status: number; message: string; auditType: string } {
    if (!this.enabled() || publicAssetRequest(req.path) || this.isPublicPath(req.path) || (req.path === "/api/shutdown" && this.isTrustedLoopback(req))) return { ok: true };
    if (!this.validOriginRequest(req)) return { ok: false, status: 403, message: "Origin not allowed", auditType: "origin.failed" };
    const session = this.currentSession(req);
    if (!session) return { ok: false, status: 401, message: "Authentication required", auditType: "auth.failed" };
    if (isUnsafeMethod(req.method) && req.header(CSRF_HEADER) !== session.csrfToken) return { ok: false, status: 403, message: "CSRF token required", auditType: "csrf.failed" };
    return { ok: true };
  }

  private enabled() {
    return Boolean(this.settings?.auth.enabled);
  }

  private requireConfigured(settings: WorkspaceSettings, secrets: AuthSecrets) {
    if (!settings.telegram?.allowedTelegramUserId || !settings.telegram.allowedChatId || !this.telegramToken(secrets)) {
      throw new Error("Telegram auth is not configured. Run: cw config telegram");
    }
  }

  private telegramToken(secrets?: AuthSecrets) {
    return process.env.CW_TELEGRAM_BOT_TOKEN || secrets?.telegram?.botToken || "";
  }

  private async createLoginRequest(req: Request) {
    this.expireOldLoginRequests();
    if (this.loginRequests.size >= LOGIN_REQUEST_LIMIT) {
      const oldest = [...this.loginRequests.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) this.loginRequests.delete(oldest.id);
    }
    const completeToken = randomToken();
    const request: LoginRequest = {
      id: `lr_${randomToken(12)}`,
      code: String(Math.floor(100000 + Math.random() * 900000)),
      ip: clientAddress(req) || "unknown",
      userAgent: req.header("user-agent") || "unknown",
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.settings?.auth.loginRequestTtlMs ?? 120000),
      status: "pending",
      replaceCurrent: Boolean(this.activeSession && !this.sessionExpired(this.activeSession)),
      completeToken,
      completeTokenHash: sha256(completeToken),
    };
    this.loginRequests.set(request.id, request);
    await this.sendLoginApproval(request);
    await this.audit.write({ type: "auth.login.requested", ip: request.ip, userAgent: request.userAgent, detail: { requestId: request.id, code: request.code } });
    return request;
  }

  private async sendLoginApproval(request: LoginRequest) {
    if (!this.telegram || !this.settings?.telegram?.allowedChatId) throw new Error("Telegram auth is not configured. Run: cw config telegram");
    const text = [
      request.replaceCurrent ? "Codex Web replacement login request" : "Codex Web login request",
      "",
      `Code: ${request.code}`,
      `IP: ${request.ip}`,
      `Device: ${request.userAgent}`,
      `Expires: ${new Date(request.expiresAt).toISOString()}`,
    ].join("\n");
    await this.telegram.sendMessage({
      chatId: this.settings.telegram.allowedChatId,
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: request.replaceCurrent ? "Replace" : "Approve", callback_data: `${CALLBACK_PREFIX}:approve:${request.id}` },
            { text: "Deny", callback_data: `${CALLBACK_PREFIX}:deny:${request.id}` },
          ],
        ],
      },
    });
  }

  private getLoginRequest(id: string) {
    const request = this.loginRequests.get(id);
    if (!request) throw new Error("Login request not found");
    if (request.status === "pending" && request.expiresAt < Date.now()) request.status = "expired";
    return request;
  }

  private createActiveSession(req: Request) {
    if (this.settings?.auth.singleSession && this.activeSession) this.activeSession.revokedAt = Date.now();
    const session: ActiveUserSession = {
      id: randomToken(),
      ip: clientAddress(req) || "unknown",
      userAgent: req.header("user-agent") || "unknown",
      csrfToken: randomToken(),
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      expiresAt: Date.now() + (this.settings?.auth.sessionAbsoluteTtlMs ?? 43200000),
    };
    this.activeSession = session;
    return session;
  }

  private currentSession(req: Request) {
    const id = parseCookie(req.header("cookie") || "")[AUTH_COOKIE];
    if (!id || !this.activeSession || this.activeSession.id !== id || this.sessionExpired(this.activeSession)) return undefined;
    return this.activeSession;
  }

  private validSessionId(id: string) {
    return Boolean(this.activeSession && this.activeSession.id === id && !this.sessionExpired(this.activeSession));
  }

  private sessionExpired(session: ActiveUserSession) {
    const now = Date.now();
    return Boolean(session.revokedAt || session.expiresAt < now || session.lastSeenAt + (this.settings?.auth.sessionIdleTimeoutMs ?? 1800000) < now || session.lastSeenAt + (this.settings?.auth.sessionStaleMs ?? 90000) < now);
  }

  private isTrustedLoopback(req: Request) {
    return isLoopback(clientAddress(req));
  }

  private isPublicPath(path: string) {
    return path === "/api/health" || path === "/api/auth/status" || path === "/api/auth/login/request" || /^\/api\/auth\/login\/[^/]+\/(?:status|complete)$/.test(path);
  }

  private validOriginRequest(req: Request) {
    if (!isUnsafeMethod(req.method)) return true;
    const origin = req.header("origin");
    if (!origin) return isLoopback(clientAddress(req));
    return sameOrigin(origin, req.header("x-forwarded-host") || req.header("host"));
  }

  private validOriginHeaders(headers: Headers, host: string, remoteAddress?: string) {
    const origin = headers.get("origin");
    if (!origin) return isLoopback(remoteAddress);
    return sameOrigin(origin, host);
  }

  private startTelegramPolling() {
    if (!this.enabled() || !this.telegram) {
      this.shutdown();
      return;
    }
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => void this.pollTelegram(), 2500);
    this.pollTimer.unref?.();
    void this.pollTelegram();
  }

  private async pollTelegram() {
    if (!this.telegram || !this.enabled() || this.telegramPolling) return;
    this.telegramPolling = true;
    try {
      const updates = await this.telegram.getUpdates(this.telegramOffset);
      for (const update of updates) {
        this.telegramOffset = update.update_id + 1;
        await this.handleTelegramUpdate(update);
      }
    } catch (error) {
      await this.audit.write({ type: "telegram.poll.failed", detail: { message: error instanceof Error ? error.message : String(error) } });
    } finally {
      this.telegramPolling = false;
    }
  }

  private async handleTelegramUpdate(update: TelegramUpdate) {
    const callback = update.callback_query;
    if (!callback?.data?.startsWith(`${CALLBACK_PREFIX}:`)) return;
    if (callback.from.id !== this.settings?.telegram?.allowedTelegramUserId) {
      await this.telegram?.answerCallbackQuery({ callbackQueryId: callback.id, text: "Not authorized" });
      await this.audit.write({ type: "auth.failed", detail: { reason: "telegram-user-mismatch", telegramUserId: callback.from.id } });
      return;
    }
    const [, action, requestId] = callback.data.split(":");
    const request = this.loginRequests.get(requestId);
    if (!request || request.expiresAt < Date.now()) {
      if (request) request.status = "expired";
      await this.telegram?.answerCallbackQuery({ callbackQueryId: callback.id, text: "Request expired" });
      return;
    }
    if (action === "deny") {
      request.status = "denied";
      await this.telegram?.answerCallbackQuery({ callbackQueryId: callback.id, text: "Denied" });
      await this.audit.write({ type: "auth.login.denied", ip: request.ip, userAgent: request.userAgent, detail: { requestId } });
      return;
    }
    if (action === "approve") {
      request.status = "approved";
      await this.telegram?.answerCallbackQuery({ callbackQueryId: callback.id, text: "Approved" });
      await this.audit.write({ type: request.replaceCurrent ? "auth.session.replacement.approved" : "auth.login.approved", ip: request.ip, userAgent: request.userAgent, detail: { requestId, owner: telegramDisplayName(callback.from) } });
    }
  }

  private expireOldLoginRequests() {
    for (const [id, request] of this.loginRequests) {
      if (request.expiresAt < Date.now() || request.status === "denied" || request.status === "expired") this.loginRequests.delete(id);
    }
  }
}

export function authRequired(host: string, explicitAuth?: "enable" | "disable") {
  if (explicitAuth === "enable") return true;
  if (explicitAuth === "disable") return false;
  if (process.env.CODEX_WEB_AUTH === "1") return true;
  if (process.env.CODEX_WEB_AUTH === "0") return false;
  return !["127.0.0.1", "localhost", "::1"].includes(host);
}

export function isLoopbackRequest(req: Request) {
  return isLoopback(clientAddress(req));
}

function setSessionCookie(req: Request, res: Response, sessionId: string) {
  res.cookie(AUTH_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure || req.header("x-forwarded-proto") === "https",
    path: "/",
  });
}

function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function sha256(input: string) {
  return createHash("sha256").update(input).digest("base64url");
}

function clientAddress(req: Request) {
  const remoteAddress = req.socket.remoteAddress;
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return isLoopback(remoteAddress) && forwarded ? forwarded : remoteAddress;
}

function isLoopback(address?: string) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address || "");
}

function publicAssetRequest(path: string) {
  return !path.startsWith("/api/") && !path.startsWith("/preview/");
}

function parseCookie(cookie: string) {
  return Object.fromEntries(
    cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function sameOrigin(origin: string, host?: string) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
