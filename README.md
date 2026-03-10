# omo claw

<p align="center">
  <img src="./docs/assets/readme-banner.png" alt="omo claw banner" width="960" />
</p>

<p align="center">
  <strong>SDK-only OpenClaw plugin and context-engine bridge for OpenCode + OmO</strong>
</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./OPERATIONS.md">Operations</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-macOS%20%2F%20Windows%20%2F%20OpenClaw-0f172a?style=for-the-badge&logo=windows&logoColor=white">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Bun%20%2B%20OpenCode-1d4ed8?style=for-the-badge&logo=bun&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-111827?style=for-the-badge">
</p>

`omo claw` connects **OpenClaw threads** to an **isolated headless OpenCode + OmO runtime**. It gives you a clean plugin entrypoint, a controlled bridge layer, replay-aware event reduction, permission flow management, and compatibility-aware operation without depending on ACP.

## Install

### Ask an agent to do it

Tell your OpenCode or OpenClaw agent:

```text
Install and configure omo claw by following the instructions here:
https://raw.githubusercontent.com/Her-xanadu/omo-claw/main/docs/guide/install.md
```

### Homebrew (macOS)

```bash
brew tap Her-xanadu/omo-claw https://github.com/Her-xanadu/omo-claw
brew install --HEAD omo-claw
omo-claw-install /path/to/your/openclaw/plugins/omo-claw
```

### npm (GitHub-backed)

```bash
npm install -g github:Her-xanadu/omo-claw
omo-claw-install /path/to/your/openclaw/plugins/omo-claw
```

On Windows, the npm wrapper installs a native launcher, so you can also run:

```powershell
npm install -g github:Her-xanadu/omo-claw
omo-claw-install C:\path\to\your\openclaw\plugins\omo-claw
```

### Git / source checkout

macOS / Linux:

```bash
git clone https://github.com/Her-xanadu/omo-claw.git
cd omo-claw
./scripts/setup-local.sh
```

Windows PowerShell:

```powershell
git clone https://github.com/Her-xanadu/omo-claw.git
Set-Location omo-claw
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

`omo-claw-install` clones the repository, runs local setup, and then prints the remaining OpenClaw registration steps.

> Windows support is currently experimental. The PowerShell install / startup path is documented below, but the repository is still macOS-first and may require a little extra validation in your environment.

---

## Why this project exists

Most integrations stop at “call an SDK and hope it works.” `omo claw` goes further:

- it isolates a dedicated headless `opencode serve` runtime
- it maps OpenClaw threads into a session tree
- it keeps permission flow, todo mirroring, summary reduction, and replay semantics in one bridge
- it adds compatibility snapshots, diff classification, and mode switching so upgrades are survivable

This makes it useful both as a **real plugin** and as a **reference implementation** for building serious OpenClaw ↔ OpenCode bridges.

---

## Architecture at a glance

<p align="center">
  <img src="./docs/assets/architecture.png" alt="omo claw architecture" width="960" />
</p>

### Core layers

| Layer | Responsibilities |
| --- | --- |
| OpenClaw | Plugin host, context-engine registration, gateway status, user entry |
| omo claw bridge core | Runtime management, SDK client, route engine, session graph, permission bridge, event reducer, replay, compatibility controller |
| Headless OpenCode + OmO | Agent execution, event stream, todo source of truth, compaction, permission requests |

---

## Highlights

### Runtime & execution
- isolated `opencode serve` runtime on port `19222`
- XDG-separated config / data / state
- Basic Auth protected bridge runtime

### Session intelligence
- thread → root session mapping
- command-first, agent-fallback routing
- message correlation for `promptAsync` + SSE flow

### Long-running task continuity
- event reduction
- summary cache
- todo mirror
- replay / rebind support
- compaction-friendly companion hook path

### Compatibility controls
- capability snapshot collection
- diff classification
- mode switching (`full`, `compatible`, `safe`, `quarantine`)
- adapter registry plumbing

---

## Prerequisites

Before using `omo claw`, make sure you have:

- [Bun](https://bun.sh/)
- `opencode` CLI available in PATH (or at `~/.opencode/bin/opencode`, `%USERPROFILE%\.opencode\bin\opencode.exe`, or `%USERPROFILE%\.opencode\bin\opencode.cmd`)
- an OpenClaw installation that supports context-engine plugins
- permission to run a local headless service on `127.0.0.1:19222`

### Supported operating systems

| OS | Status | Notes |
| --- | --- | --- |
| macOS | ✅ primary tested platform | recommended environment |
| Linux | ⚠️ partially supported | only if your OpenClaw + OpenCode stack already works |
| Windows | ⚠️ experimental | PowerShell install / startup scripts are available, but the project is still macOS-first |

### Required software

| Requirement | Why it is needed |
| --- | --- |
| Bun | install dependencies and run the TypeScript project scripts |
| OpenCode CLI (`opencode`) | starts the isolated headless runtime |
| OpenClaw | hosts the plugin / context-engine |
| Local filesystem access | stores runtime config, state, and generated definitions |

### Before you run setup

- confirm `bun --version` works
- confirm `opencode --help` works, or `~/.opencode/bin/opencode` / `%USERPROFILE%\.opencode\bin\opencode.exe` exists
- confirm OpenClaw can load plugins from your plugin workspace
- confirm port `19222` is available

If PowerShell blocks direct script execution on Windows, use `powershell -ExecutionPolicy Bypass -File <script.ps1>` for the commands below.

> Homebrew and npm can bootstrap installation, but this repository is still an OpenClaw plugin project with a managed runtime bridge.

---

## Run after install

macOS / Linux:

```bash
./integration/bridge-runtime/bridge-launcher.sh
./tests/live/runtime-health.smoke.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\integration\bridge-runtime\bridge-launcher.ps1
powershell -ExecutionPolicy Bypass -File .\tests\live\runtime-health.smoke.ps1
```

If everything is wired correctly, the smoke check returns:

```json
{"healthy": true, "version": "1.2.21"}
```

---

## Install into OpenClaw

1. Place this repository into your OpenClaw plugin workspace.
2. Register `openclaw.plugin.json` with your OpenClaw installation.
3. Configure the context-engine slot to use plugin id **`omo-claw`**.
4. Start the bridge runtime with `./integration/bridge-runtime/bridge-launcher.sh` on macOS / Linux, or `powershell -ExecutionPolicy Bypass -File .\integration\bridge-runtime\bridge-launcher.ps1` on Windows.
5. Verify the runtime with `./tests/live/runtime-health.smoke.sh` on macOS / Linux, or `powershell -ExecutionPolicy Bypass -File .\tests\live\runtime-health.smoke.ps1` on Windows.

The main OpenClaw-facing identifiers are:

| Item | Value |
| --- | --- |
| Plugin id | `omo-claw` |
| Plugin name | `omo claw` |
| Gateway method | `omo-claw.status` |
| Status command | `omo_claw_status` |

---

## Local development

macOS / Linux:

```bash
./scripts/setup-local.sh
bun test
bun run typecheck
./tests/live/runtime-health.smoke.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
bun test
bun run typecheck
powershell -ExecutionPolicy Bypass -File .\tests\live\runtime-health.smoke.ps1
```

Useful extra commands:

macOS / Linux:

```bash
bun run compile:definitions
./scripts/publish-github.sh omo-claw Her-xanadu public
```

Windows PowerShell:

```powershell
bun run compile:definitions
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1 omo-claw Her-xanadu public
```

---

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/` | bridge implementation |
| `integration/bridge-runtime/` | isolated runtime wrapper, config, launcher |
| `definitions/` | single-source IR, compiler, generated manifests |
| `compatibility/` | snapshots, diff classifier, adapter registry |
| `contracts/` | machine-checkable bridge contracts |
| `tests/` | unit, contract, e2e, smoke verification |
| `Formula/` | Homebrew formula for the installer wrapper |
| `docs/guide/` | agent-friendly install guides |
| `docs/assets/` | README visual assets |

---

## Security notes

- never commit `integration/bridge-runtime/.bridge-secret`
- keep runtime state under ignored `integration/bridge-runtime/xdg/`
- review generated artifacts before publishing if local metadata changes
- validate compatibility mode and event-directory filtering after upgrades

---

## Documentation

- [Agent install guide](./docs/guide/install.md)
- [中文安装说明](./docs/guide/install.zh-CN.md)
- [中文说明 / README.zh-CN.md](./README.zh-CN.md)
- [Operations](./OPERATIONS.md)
- [Publishing](./PUBLISHING.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

---

## Contributors

- [OpenClaw](https://github.com/OpenClaw/openclaw) for the plugin host and context-engine surface
- [OpenCode](https://opencode.ai/) for the SDK/runtime model that powers the bridge

---

## License

MIT
