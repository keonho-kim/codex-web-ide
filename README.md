# Codex Web IDE

<p align="center">
  <strong>Local-first Codex development environment for Termux, Linux, WSL, and macOS.</strong>
</p>

<p align="center">
  <a href="https://github.com/keonho-kim/codex-web-ide/releases/latest">
    <img alt="Latest release" src="https://img.shields.io/github/v/release/keonho-kim/codex-web-ide?sort=semver">
  </a>
  <img alt="Runtime: Bun" src="https://img.shields.io/badge/runtime-Bun-202627">
  <img alt="Termux first" src="https://img.shields.io/badge/platform-Termux%20first-466a76">
  <img alt="Status: early stage" src="https://img.shields.io/badge/status-early%20stage-7b6a42">
</p>

Codex Web IDE turns a local Codex runtime into a focused browser workspace for project sessions, files, Codex conversations, previews, jobs, services, terminals, and Git workflows. It is designed for Android tablets through Termux first, while keeping the same Bun-based runtime practical on Linux, WSL, and macOS.

## Contents

- [Highlights](#highlights)
- [Requirements](#requirements)
- [Install](#install)
- [Quick Start](#quick-start)
- [Managed Commands](#managed-commands)
- [External Access](#external-access)
- [Architecture](#architecture)
- [Development](#development)
- [Release Workflow](#release-workflow)
- [Environment](#environment)
- [Project Status](#project-status)

## Highlights

- **Installable CLI:** run the app with `cw start` or `codex-web start`.
- **Local-first runtime:** files, Git, Codex sessions, terminals, jobs, previews, and services stay on your machine.
- **Real development workspace:** project/session navigation, file tree, Monaco editor, Codex chat, managed commands, preview panel, and Git controls.
- **Managed process lifecycle:** use `cw job`, `cw preview`, and `cw service` so the backend can track commands, logs, ports, and status.
- **Termux-first remote access:** expose the app through Tailscale and Telegram approval auth instead of public port forwarding.
- **Portable release archives:** production installs use prebuilt GitHub Release artifacts, so target devices do not need to build the web UI locally.

## Requirements

- Bun 1.1+
- Git
- curl and tar
- Codex CLI or SDK access
- Optional project runtimes such as Python, Go, Rust, or Node.js, depending on the projects you open

Supported release targets:

| Platform | CPU |
| --- | --- |
| Termux / proot Linux | `arm64`, `x64` |
| Linux / WSL | `arm64`, `x64` |
| macOS | `arm64`, `x64` |

## Install

Install the latest npm package:

```bash
npm install -g @keonhokim/codex-web
```

or with Bun:

```bash
bun install -g @keonhokim/codex-web
```

The npm package includes the built web UI and runtime source. It expects Bun to be available on `PATH` because the `cw` launcher runs the Bun-based CLI.

Install the latest GitHub Release archive directly when you want the portable platform tarball installer:

```bash
curl -fsSL https://github.com/keonho-kim/codex-web-ide/releases/latest/download/install.sh | sh
```

By default, the installer resolves the current latest GitHub Release tag before downloading the matching production archive.

Verify the CLI:

```bash
cw doctor
cw start
```

Open the app:

```text
http://127.0.0.1:17321
```

Pin a specific release when you need reproducible installs:

```bash
curl -fsSL https://github.com/keonho-kim/codex-web-ide/releases/latest/download/install.sh | CW_VERSION=v0.1.4 sh
```

Use `CW_VERSION` only when you want to pin a release. Version values without a leading `v` are normalized automatically, so `CW_VERSION=0.1.4` resolves to `v0.1.4`.

The GitHub Release installer downloads an archive that already contains the built web UI and runtime dependencies:

```text
https://github.com/<owner>/<repo>/releases/download/v0.1.4/codex-web-ide-0.1.4-linux-arm64.tgz
```

It does not run `bun install -g`, so Termux, proot, Linux, WSL, and macOS machines do not need to compile native runtime dependencies during direct archive installation.

Upgrade an installed release in place:

```bash
cw upgrade
```

`cw upgrade` reruns the release installer for the same install root and prunes older release directories after a successful install. It does not remove user data under `~/.codex-web`.

Uninstall the release installation and command launchers:

```bash
cw uninstall
```

## Quick Start

Initialize a project session and start the local server:

```bash
cw init /path/to/project
cw start
```

Useful runtime commands:

```bash
cw status
cw open
cw stop
cw restart
```

The default app URL is:

```text
http://127.0.0.1:17321
```

## Managed Commands

Run project commands through Codex Web IDE so process state, logs, ports, and previews remain visible in the UI.

```bash
cw job bun test
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

`cw start` defaults to loopback access with authentication disabled. Keep that default for local-only use.

For remote access, prefer Tailscale over public port forwarding:

```bash
cw config telegram
tailscale ip -4
cw start --host 0.0.0.0 --port 17321 --auth enable
```

Then open the app from another device in the same tailnet:

```text
http://<tailscale-ip>:17321
```

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

Use this path when you are developing Codex Web IDE from a local checkout.

```bash
bun install
bun test
bun run build
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

Package a local production archive on a machine that can run builds:

```bash
bun run pack:production
```

Prepare the npm publish package locally:

```bash
bun run pack:npm
```

Use the npm package or GitHub Release artifact for normal installs so Termux, proot, Linux, WSL, and macOS users do not need to run `bun run build` locally.

## Release Workflow

GitHub Releases are built from version tags. To publish `v0.1.4`, push a tag that matches `package.json`:

```bash
git tag v0.1.4
git push origin v0.1.4
```

The GitHub Actions release workflow checks the installer, runs release-safe tests, builds the package, creates platform production archives such as `dist/codex-web-ide-0.1.4-linux-arm64.tgz` and `dist/codex-web-ide-0.1.4-macos-arm64.tgz`, and uploads them with `install.sh` to the matching GitHub Release.

The npm release workflow prepares `dist/npm/package`, publishes `@keonhokim/codex-web`, and sets the published version as the npm `latest` dist-tag for every matching release tag.

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

Codex Web IDE is early-stage and intentionally local-first. The implementation follows [PRODUCT.md](PRODUCT.md) for product scope and [DESIGN.md](DESIGN.md) for UI direction.
