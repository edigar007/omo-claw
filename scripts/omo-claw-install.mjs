#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)

const result = process.platform === "win32"
  ? runWindowsInstaller()
  : spawnSync("sh", [join(scriptDir, "install-plugin.sh"), ...args], { stdio: "inherit" })

if (typeof result.error !== "undefined") {
  console.error(result.error.message)
}

process.exit(result.status ?? 1)

function runWindowsInstaller() {
  const shell = resolvePowerShell()
  if (!shell) {
    console.error("PowerShell is required to run the Windows installer.")
    return { status: 1 }
  }

  return spawnSync(shell, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    join(scriptDir, "install-plugin.ps1"),
    ...args,
  ], { stdio: "inherit" })
}

function resolvePowerShell() {
  for (const candidate of ["pwsh.exe", "powershell.exe", "pwsh", "powershell"]) {
    const probe = spawnSync("where", [candidate], { stdio: "ignore" })
    if (probe.status === 0) {
      return candidate
    }
  }

  return null
}
