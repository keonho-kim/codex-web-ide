import type { Express } from "express";
import type { Server } from "node:http";
import type { AppServices } from "../../api/context";
import { previewWebSocketHandlers } from "./bridge";
import { clientAddress, isWebSocketRequest, proxyHttpRequest } from "./http";
import { previewWebSocketTarget } from "./target";
import type { BunServe } from "./types";

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
    fetch: (req, server) => {
      const url = new URL(req.url);
      if (isWebSocketRequest(req)) {
        if (!services.auth.isAuthorizedHeaders(req.headers, url, clientAddress(req, server))) {
          return new Response("Authentication required", { status: 401 });
        }
        const target = previewWebSocketTarget(req, services);
        if (!target) return new Response("Preview WebSocket target not found", { status: 404 });
        return server.upgrade(req, { data: { target } })
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 502 });
      }
      return proxyHttpRequest(req, internal.port, server);
    },
    websocket: previewWebSocketHandlers,
  });

  return {
    close: async () => {
      front.stop(true);
      await closeInternal(internal.server);
    },
  };
}

function listenInternal(app: Express) {
  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Internal server did not expose a TCP port."));
        return;
      }
      resolve({ server, port: address.port });
    });
    server.once("error", reject);
  });
}

function closeInternal(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
