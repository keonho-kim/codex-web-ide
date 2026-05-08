import type { Express } from "express";
import type { Server } from "node:http";
import type { AppServices } from "../api/context";

type BunServer = {
  stop(force?: boolean): void;
};

type BunServe = (options: {
  hostname: string;
  port: number;
  fetch(req: Request, server: BunUpgradeServer): Response | Promise<Response> | undefined;
  websocket: {
    data: PreviewSocketData;
    open(ws: ServerSocket): void;
    message(ws: ServerSocket, message: string | ArrayBuffer | Uint8Array): void;
    close(ws: ServerSocket): void;
  };
}) => BunServer;

type BunUpgradeServer = {
  upgrade(req: Request, options: { data: PreviewSocketData }): boolean;
};

type ServerSocket = {
  data: PreviewSocketData;
  readyState: number;
  send(message: string | ArrayBuffer | Uint8Array): number;
  close(code?: number, reason?: string): void;
};

type PreviewSocketData = {
  target: string;
  upstream?: WebSocket;
  upstreamOpen?: boolean;
  queuedMessages?: Array<string | ArrayBuffer | Uint8Array>;
};

const CLIENT_WS_CLOSING = 2;

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
      if (isWebSocketRequest(req)) {
        const target = previewWebSocketTarget(req, services);
        if (!target) return new Response("Preview WebSocket target not found", { status: 404 });
        return server.upgrade(req, { data: { target } })
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 502 });
      }
      return proxyHttpRequest(req, internal.port);
    },
    websocket: {
      data: {} as PreviewSocketData,
      open: openPreviewSocket,
      message: forwardClientMessage,
      close: closePreviewSocket,
    },
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

function isWebSocketRequest(req: Request) {
  return req.headers.get("upgrade")?.toLowerCase() === "websocket";
}

function previewWebSocketTarget(req: Request, { commands }: AppServices) {
  const url = new URL(req.url);
  const preview = previewFromPath(url.pathname) ?? previewFromReferer(req.headers.get("referer"));
  if (!preview) return null;
  const target = commands.getPreviewTarget(preview.sessionId, preview.previewId);
  if (!target) return null;
  return toUpstreamWebSocketUrl(target, url, preview);
}

function previewFromPath(pathname: string) {
  const match = pathname.match(/^\/preview\/([^/]+)\/([^/]+)(?:\/|$)/);
  return match ? { sessionId: match[1], previewId: match[2], prefix: `/preview/${match[1]}/${match[2]}` } : null;
}

function previewFromReferer(referer: string | null) {
  if (!referer) return null;
  try {
    return previewFromPath(new URL(referer).pathname);
  } catch {
    return previewFromPath(referer);
  }
}

function toUpstreamWebSocketUrl(target: string, requestUrl: URL, preview: { prefix: string }) {
  const upstream = new URL(target);
  upstream.protocol = upstream.protocol === "https:" ? "wss:" : "ws:";
  upstream.pathname = requestUrl.pathname.startsWith(preview.prefix)
    ? requestUrl.pathname.slice(preview.prefix.length) || "/"
    : requestUrl.pathname;
  upstream.search = requestUrl.search;
  return upstream.toString();
}

function proxyHttpRequest(req: Request, internalPort: number) {
  const url = new URL(req.url);
  url.protocol = "http:";
  url.hostname = "127.0.0.1";
  url.port = String(internalPort);
  const headers = new Headers(req.headers);
  headers.set("host", `127.0.0.1:${internalPort}`);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    redirect: "manual",
  });
}

function openPreviewSocket(ws: ServerSocket) {
  const upstream = new WebSocket(ws.data.target);
  ws.data.upstream = upstream;
  ws.data.upstreamOpen = false;
  ws.data.queuedMessages = [];

  upstream.binaryType = "arraybuffer";
  upstream.addEventListener("open", () => {
    ws.data.upstreamOpen = true;
    for (const message of ws.data.queuedMessages ?? []) upstream.send(message);
    ws.data.queuedMessages = [];
  });
  upstream.addEventListener("message", (event) => {
    ws.send(event.data as string | ArrayBuffer | Uint8Array);
  });
  upstream.addEventListener("close", (event) => {
    if (ws.readyState < CLIENT_WS_CLOSING) ws.close(event.code, event.reason);
  });
  upstream.addEventListener("error", () => {
    if (ws.readyState < CLIENT_WS_CLOSING) ws.close(1011, "Preview WebSocket proxy error");
  });
}

function forwardClientMessage(ws: ServerSocket, message: string | ArrayBuffer | Uint8Array) {
  if (ws.data.upstreamOpen) {
    ws.data.upstream?.send(message);
    return;
  }
  ws.data.queuedMessages?.push(message);
}

function closePreviewSocket(ws: ServerSocket) {
  ws.data.upstream?.close();
}
