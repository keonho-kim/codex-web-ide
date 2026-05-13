declare module "bun-pty" {
  export type IDisposable = {
    dispose(): void;
  };

  export type IPty = {
    pid: number;
    onData(callback: (output: string) => void): IDisposable;
    onExit(callback: (event: { exitCode?: number | null; signal?: number | string | null }) => void): IDisposable;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(): void;
  };

  export function spawn(
    command: string,
    args: string[],
    options: {
      cols?: number;
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      name?: string;
      rows?: number;
    },
  ): IPty;
}
