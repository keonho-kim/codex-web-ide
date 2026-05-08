import net from "node:net";

export type PreviewPortReport = {
  sampled: string[];
  available: boolean;
};

export async function checkPreviewPorts(start: number, end: number): Promise<PreviewPortReport> {
  const sampled = [...new Set([start, Math.floor((start + end) / 2), end])].filter((port) => Number.isInteger(port) && port > 0);
  const checks = await Promise.all(sampled.map(async (port) => ({ port, available: await isPortAvailable(port) })));
  return {
    sampled: checks.map((check) => `${check.port}:${check.available ? "available" : "in-use"}`),
    available: checks.length > 0 && checks.every((check) => check.available),
  };
}

export function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}
