# Codex Web IDE

Local-first Codex development environment with a focused web UI for projects, files, conversations, previews, jobs, services, terminals, and Git workflows.

Codex Web IDE is designed for Termux first, with the same Bun-based runtime kept practical on macOS, Linux, and WSL.

## Highlights

- **Installable CLI**: run the app with `cw start` or `codex-web start`.
- **Local runtime**: files, Git, Codex sessions, terminals, jobs, previews, and services stay on your machine.
- **Web UI for real work**: project/session navigation, file tree, Monaco editor, Codex chat, managed commands, preview panel, and Git controls.
- **Managed execution**: use `cw job`, `cw preview`, and `cw service` so the backend can track processes, logs, ports, and lifecycle.
- **Termux-first remote access**: pair Tailscale with Telegram approval auth when exposing the app beyond loopback.

## Requirements

- Bun 1.1+
- Git
- Codex CLI or SDK access
- Optional project runtimes such as Python, Go, Rust, or Node.js, depending on the projects you open

## Install

Install the latest release with the installer script:

```bash
curl -fsSL https://github.com/keonho-kim/codex-web-ide/releases/latest/download/install.sh | sh
```

Verify the CLI:

```bash
cw doctor
cw start
```

The default app URL is:

```text
http://127.0.0.1:17321
```

The installer detects Termux, Linux, WSL, proot-based Linux, and macOS on `arm64` and `x64`. To pin a version, pass `CW_VERSION` to the shell that runs the installer:

```bash
curl -fsSL https://github.com/keonho-kim/codex-web-ide/releases/latest/download/install.sh | CW_VERSION=v0.1.3 sh
```

The installer downloads a production release archive that already contains the built web UI and runtime dependencies:

```bash
https://github.com/<owner>/<repo>/releases/download/v0.1.3/codex-web-ide-0.1.3-linux-arm64.tgz
```

The installer does not run `bun install -g`, so native dependencies such as `node-pty` are built in GitHub Actions instead of on the target Termux/proot/macOS machine.

## Local Package Development

Use this path only when you are developing the release package from a local checkout on a machine that can run builds.

Build the web UI, prepare the install launcher, and pack a portable production archive:

```bash
bun install
bun run pack:production
```

The normal install path should use the GitHub Release artifact instead, so Termux/proot/macOS users do not need to run `bun run build` locally.

## Release Workflow

GitHub Releases are built from version tags. To publish `v0.1.3`, push a tag that matches `package.json`:

```bash
git tag v0.1.3
git push origin v0.1.3
```

The GitHub Actions release workflow checks the installer, runs release-safe tests, builds the package, creates platform production archives such as `dist/codex-web-ide-0.1.3-linux-arm64.tgz` and `dist/codex-web-ide-0.1.3-macos-arm64.tgz`, and uploads them with `install.sh` to the matching GitHub Release.

## Quick Start

```bash
cw init /path/to/project
cw start
```

Open the app:

```text
http://127.0.0.1:17321
```

Useful runtime commands:

```bash
cw status
cw open
cw stop
cw restart
```

## Managed Commands

Run project commands through Codex Web IDE so process state, logs, ports, and previews remain visible in the UI.

```bash
cw job bun run build
cw preview bun run dev
cw service python bot.py
```

Use:

- `cw job` for commands expected to finish.
- `cw preview` for browser-viewable development servers.
- `cw service` for long-running background processes.

Dangerous commands are blocked unless explicitly approved:

```bash
cw job --approve-dangerous git reset --hard
```

## External Access

`cw start` defaults to authentication disabled and should stay on loopback for local use.

For remote access, prefer Tailscale over public port forwarding:

```bash
cw config telegram
tailscale ip -4
cw start --host 0.0.0.0 --port 17321 --auth enable
```

Then open `http://<tailscale-ip>:17321` from another device in the same tailnet and approve the browser session from Telegram.

See [External Access With Tailscale And Telegram Auth](docs/external-access.md) for the full setup and security checklist.

## Architecture

```text
Browser / WebView
  -> React Web UI
  -> Express Backend
  -> Local runtime: Codex, Git, Bun, shell, filesystem, project tools
```

The backend owns filesystem access, command execution, previews, services, terminals, Git state, project sessions, and Codex sessions. The browser UI stays a client of those local services.

## Development

```bash
bun install
bun run build
bun test
```

Start the app from source:

```bash
bun run cw start
```

Run the frontend dev server:

```bash
bun run dev:web
```

Browser validation:

```bash
bun run setup:e2e
bun run test:e2e
```

## Environment

```text
CODEX_WEB_HOME                 Data directory, default ~/.codex-web
CODEX_WEB_HOST                 App host, default 127.0.0.1
CODEX_WEB_PORT                 App port, default 17321
CODEX_WEB_AUTH                 1 to force auth, 0 to disable auth
CW_TELEGRAM_BOT_TOKEN          Telegram bot token override for auth
CW_TELEGRAM_API_BASE           Telegram Bot API base URL, mainly for tests
CW_SESSION_SECRET              Session secret override
CW_CSRF_SECRET                 CSRF secret override
CODEX_WEB_PREVIEW_PORT_START   Preview port range start, default 17330
CODEX_WEB_PREVIEW_PORT_END     Preview port range end, default 17399
```

## Project Status

This repository is early-stage and intentionally local-first. The implementation follows [PRODUCT.md](PRODUCT.md) for product scope and [DESIGN.md](DESIGN.md) for UI direction.
