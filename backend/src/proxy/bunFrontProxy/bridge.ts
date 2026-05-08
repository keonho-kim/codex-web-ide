import type { PreviewSocketData, ServerSocket } from "./types";

const CLIENT_WS_CLOSING = 2;

export const previewWebSocketHandlers = {
  data: {} as PreviewSocketData,
  open: openPreviewSocket,
  message: forwardClientMessage,
  close: closePreviewSocket,
};

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
