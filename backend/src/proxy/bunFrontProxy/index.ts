import type { Express } from "express";
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { AppServices } from "@backend/api/context";
import { frontProxyWebSocketHandlers } from "@backend/proxy/bunFrontProxy/bridge";
import { clientAddress, isWebSocketRequest, proxyHttpRequest } from "@backend/proxy/bunFrontProxy/http";
import { previewWebSocketTarget } from "@backend/proxy/bunFrontProxy/target";
import type { BunServe } from "@backend/proxy/bunFrontProxy/types";

const FRONT_PROXY_IDLE_TIMEOUT_SECONDS = 255;
const INTERNAL_SERVER_SHUTDOWN_GRACE_MS = 300;

type InternalListener = {
  port: number;
  server: Server;
  sockets: Set<Socket>;
};

export function canUseBunFrontProxy() {
  return typeof (globalThis as typeof globalThis & { Bun?: { serve?: BunServe } }).Bun?.serve === "function";
}

export async function startBunFrontProxy({
  app,
  host,
  port,
  services,
}: {
  app: Express;
  host: string;
  port: number;
  services: AppServices;
}) {
  const internal = await listenInternal(app);
  const bun = (globalThis as typeof globalThis & { Bun: { serve: BunServe } }).Bun;
  const front = bun.serve({
    hostname: host,
    port,
    idleTimeout: FRONT_PROXY_IDLE_TIMEOUT_SECONDS,
    fetch: (req, server) => {
      const url = new URL(req.url);
      if (isWebSocketRequest(req)) {
        if (!services.auth.isAuthorizedHeaders(req.headers, url, clientAddress(req, server))) {
          return new Response("Authentication required", { status: 401 });
        }
        const terminal = terminalWebSocketTarget(url, services);
        if (terminal) {
          return server.upgrade(req, { data: terminal })
            ? undefined
            : new Response("WebSocket upgrade failed", { status: 502 });
        }
        const target = previewWebSocketTarget(req, services);
        if (!target) return new Response("Preview WebSocket target not found", { status: 404 });
        return server.upgrade(req, { data: { kind: "preview", target } })
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 502 });
      }
      if (isLongLivedHttpRequest(url)) server.timeout?.(req, 0);
      return proxyHttpRequest(req, internal.port, server);
    },
    websocket: frontProxyWebSocketHandlers,
  });

  return {
    close: async () => {
      front.stop(true);
      await closeInternal(internal);
    },
  };
}

function listenInternal(app: Express) {
  return new Promise<InternalListener>((resolve, reject) => {
    const sockets = new Set<Socket>();
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Internal server did not expose a TCP port."));
        return;
      }
      resolve({ server, port: address.port, sockets });
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    server.once("error", reject);
  });
}

function closeInternal(internal: InternalListener) {
  return new Promise<void>((resolve, reject) => {
    const forceDrain = setTimeout(() => {
      internal.server.closeIdleConnections?.();
      internal.server.closeAllConnections?.();
      for (const socket of internal.sockets) socket.destroy();
    }, INTERNAL_SERVER_SHUTDOWN_GRACE_MS);
    forceDrain.unref?.();

    internal.server.close((error) => {
      clearTimeout(forceDrain);
      if (error) reject(error);
      else resolve();
    });
  });
}

export function isLongLivedHttpRequest(url: URL) {
  return url.pathname === "/api/sessions/events" || /^\/api\/sessions\/[^/]+\/(?:codex\/)?events$/.test(url.pathname);
}

function terminalWebSocketTarget(url: URL, services: AppServices) {
  const match = /^\/api\/sessions\/([^/]+)\/terminals\/([^/]+)\/ws$/.exec(url.pathname);
  if (!match) return undefined;
  return {
    kind: "terminal" as const,
    services,
    sessionId: decodeURIComponent(match[1]),
    terminalId: decodeURIComponent(match[2]),
  };
}
