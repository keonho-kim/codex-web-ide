import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import type { WorkspaceManager } from "../managers/workspaceManager";

export type AuthState = {
  enabled: boolean;
  token?: string;
};

export class AuthManager {
  private state: AuthState = { enabled: false };
  private forceLoopbackAuth = false;

  constructor(private workspace: WorkspaceManager) {}

  async initialize(required: boolean) {
    this.forceLoopbackAuth = process.env.CODEX_WEB_AUTH === "1";
    const settings = await this.workspace.getSettings();
    const enabled = required || settings.auth.enabled;
    const token = enabled ? settings.auth.token || randomToken() : settings.auth.token;
    this.state = { enabled, token };
    if (enabled !== settings.auth.enabled || token !== settings.auth.token) {
      await this.workspace.updateSettings({ ...settings, auth: { enabled, token } });
    }
    return this.state;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.isAuthorizedRequest(req)) {
        next();
        return;
      }
      res.status(401).json({ error: "Authentication required" });
    };
  }

  registerRoutes(app: Express) {
    app.get("/api/auth/status", (req, res) => {
      res.json({ enabled: this.state.enabled, authenticated: !this.state.enabled || this.isTrustedLoopback(req) || this.hasValidCredentials(requestCredentials(req)) });
    });
    app.post("/api/auth/login", (req, res) => {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      if (!this.compareToken(token)) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      res.cookie("cw_token", token, { httpOnly: true, sameSite: "strict", path: "/" });
      res.json({ ok: true });
    });
  }

  getStatus() {
    return this.state;
  }

  isAuthorizedHeaders(headers: Headers, url: URL, remoteAddress?: string) {
    return this.isAuthorized({
      path: url.pathname,
      remoteAddress,
      credentials: {
        authorization: headers.get("authorization") || undefined,
        cookie: headers.get("cookie") || undefined,
        explicitToken: headers.get("x-codex-web-token") || url.searchParams.get("token") || undefined,
      },
    });
  }

  private isAuthorizedRequest(req: Request) {
    return this.isAuthorized({ path: req.path, remoteAddress: clientAddress(req), credentials: requestCredentials(req) });
  }

  private isAuthorized({
    credentials,
    path,
    remoteAddress,
  }: {
    credentials: RequestCredentials;
    path: string;
    remoteAddress?: string;
  }) {
    if (!this.state.enabled || (!this.forceLoopbackAuth && isLoopback(remoteAddress)) || publicAssetRequest(path)) return true;
    if (["/api/health", "/api/auth/status", "/api/auth/login"].includes(path)) return true;
    return this.hasValidCredentials(credentials);
  }

  private hasValidCredentials(credentials: RequestCredentials) {
    const header = credentials.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    const explicit = credentials.explicitToken || bearer;
    const cookie = parseCookie(credentials.cookie || "").cw_token;
    return this.compareToken(typeof explicit === "string" ? explicit : "") || this.compareToken(cookie || "");
  }

  private isTrustedLoopback(req: Request) {
    return !this.forceLoopbackAuth && isLoopback(clientAddress(req));
  }

  private compareToken(input: string) {
    if (!this.state.token || input.length !== this.state.token.length) return false;
    return timingSafeEqual(Buffer.from(input), Buffer.from(this.state.token));
  }
}

type RequestCredentials = {
  authorization?: string;
  cookie?: string;
  explicitToken?: string;
};

export function authRequired(host: string) {
  if (process.env.CODEX_WEB_AUTH === "1") return true;
  if (process.env.CODEX_WEB_AUTH === "0") return false;
  return !["127.0.0.1", "localhost", "::1"].includes(host);
}

function randomToken() {
  return randomBytes(24).toString("base64url");
}

export function isLoopbackRequest(req: Request) {
  return isLoopback(clientAddress(req));
}

function clientAddress(req: Request) {
  const remoteAddress = req.socket.remoteAddress;
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return isLoopback(remoteAddress) && forwarded ? forwarded : remoteAddress;
}

function requestCredentials(req: Request): RequestCredentials {
  return {
    authorization: req.header("authorization"),
    cookie: req.header("cookie"),
    explicitToken: req.header("x-codex-web-token") || (typeof req.query.token === "string" ? req.query.token : undefined),
  };
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
