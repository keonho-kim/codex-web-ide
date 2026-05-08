import net from "node:net";

export class PortAllocator {
  private usedPorts = new Set<number>();

  constructor(
    private start: number,
    private end: number,
  ) {}

  async allocate() {
    for (let port = this.start; port <= this.end; port += 1) {
      if (this.usedPorts.has(port)) continue;
      if (!(await isPortAvailable(port))) continue;
      this.usedPorts.add(port);
      return port;
    }
    throw new Error("No preview ports available");
  }

  release(port: number) {
    this.usedPorts.delete(port);
  }
}

function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}
