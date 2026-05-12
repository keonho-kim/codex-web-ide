import type { ServerSocket, SocketData } from "@backend/proxy/bunFrontProxy/types";

const CLIENT_WS_CLOSING = 2;

export const frontProxyWebSocketHandlers = {
  data: {} as SocketData,
  open: (ws: ServerSocket) => {
    if (ws.data.kind === "terminal") {
      openTerminalSocket(ws);
      return;
    }
    openPreviewSocket(ws);
  },
  message: (ws: ServerSocket, message: string | ArrayBuffer | Uint8Array) => {
    if (ws.data.kind === "terminal") {
      forwardTerminalMessage(ws, message);
      return;
    }
    forwardPreviewMessage(ws, message);
  },
  close: (ws: ServerSocket) => {
    if (ws.data.kind === "terminal") {
      closeTerminalSocket(ws);
      return;
    }
    closePreviewSocket(ws);
  },
};

function openPreviewSocket(ws: ServerSocket) {
  if (ws.data.kind !== "preview") return;
  const data = ws.data;
  const upstream = new WebSocket(data.target);
  data.upstream = upstream;
  data.upstreamOpen = false;
  data.queuedMessages = [];

  upstream.binaryType = "arraybuffer";
  upstream.addEventListener("open", () => {
    data.upstreamOpen = true;
    for (const message of data.queuedMessages ?? []) upstream.send(message);
    data.queuedMessages = [];
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

function forwardPreviewMessage(ws: ServerSocket, message: string | ArrayBuffer | Uint8Array) {
  if (ws.data.kind !== "preview") return;
  if (ws.data.upstreamOpen) {
    ws.data.upstream?.send(message);
    return;
  }
  ws.data.queuedMessages?.push(message);
}

function closePreviewSocket(ws: ServerSocket) {
  if (ws.data.kind !== "preview") return;
  ws.data.upstream?.close();
}

function openTerminalSocket(ws: ServerSocket) {
  if (ws.data.kind !== "terminal") return;
  ws.data.clientId = ws.data.services.terminals.attach(ws.data.sessionId, ws.data.terminalId, {
    send: (message) => {
      if (ws.readyState < CLIENT_WS_CLOSING) ws.send(message);
    },
  });
}

function forwardTerminalMessage(ws: ServerSocket, message: string | ArrayBuffer | Uint8Array) {
  if (ws.data.kind !== "terminal") return;
  if (typeof message !== "string") return;
  const payload = parseMessage(message);
  if (payload?.type === "input" && typeof payload.data === "string") {
    ws.data.services.terminals.write(ws.data.sessionId, ws.data.terminalId, payload.data);
    return;
  }
  if (payload?.type === "resize" && typeof payload.cols === "number" && typeof payload.rows === "number") {
    ws.data.services.terminals.resize(ws.data.sessionId, ws.data.terminalId, payload.cols, payload.rows);
  }
}

function closeTerminalSocket(ws: ServerSocket) {
  if (ws.data.kind !== "terminal") return;
  ws.data.services.terminals.detach(ws.data.sessionId, ws.data.terminalId, ws.data.clientId);
}

function parseMessage(message: string) {
  try {
    return JSON.parse(message) as { type?: string; data?: unknown; cols?: unknown; rows?: unknown };
  } catch {
    return undefined;
  }
}
