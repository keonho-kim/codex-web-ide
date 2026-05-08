import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import type { WorkspaceManager } from "../managers/workspaceManager";

export type AuthState = {
  enabled: boolean;
  token?: string;
};

export class AuthManager {
  private state: AuthState = { enabled: false };

  constructor(private workspace: WorkspaceManager) {}

  async initialize(required: boolean) {
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
      if (!this.state.enabled || isLoopback(req.socket.remoteAddress) || publicAssetRequest(req.path)) {
        next();
        return;
      }
      if (["/api/health", "/api/auth/status", "/api/auth/login"].includes(req.path)) {
        next();
        return;
      }
      if (this.isValidRequest(req)) {
        next();
        return;
      }
      res.status(401).json({ error: "Authentication required" });
    };
  }

  registerRoutes(app: Express) {
    app.get("/api/auth/status", (req, res) => {
      res.json({ enabled: this.state.enabled, authenticated: !this.state.enabled || isLoopback(req.socket.remoteAddress) || this.isValidRequest(req) });
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

  private isValidRequest(req: Request) {
    const header = req.header("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    const explicit = req.header("x-codex-web-token") || bearer || req.query.token;
    const cookie = parseCookie(req.header("cookie") || "").cw_token;
    return this.compareToken(typeof explicit === "string" ? explicit : "") || this.compareToken(cookie || "");
  }

  private compareToken(input: string) {
    if (!this.state.token || input.length !== this.state.token.length) return false;
    return timingSafeEqual(Buffer.from(input), Buffer.from(this.state.token));
  }
}

export function authRequired(host: string) {
  if (process.env.CODEX_WEB_AUTH === "1") return true;
  if (process.env.CODEX_WEB_AUTH === "0") return false;
  return !["127.0.0.1", "localhost", "::1"].includes(host);
}

function randomToken() {
  return randomBytes(24).toString("base64url");
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
