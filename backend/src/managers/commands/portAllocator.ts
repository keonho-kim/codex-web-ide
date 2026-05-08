export class PortAllocator {
  private usedPorts = new Set<number>();

  constructor(
    private start: number,
    private end: number,
  ) {}

  allocate() {
    for (let port = this.start; port <= this.end; port += 1) {
      if (this.usedPorts.has(port)) continue;
      this.usedPorts.add(port);
      return port;
    }
    throw new Error("No preview ports available");
  }

  release(port: number) {
    this.usedPorts.delete(port);
  }
}
