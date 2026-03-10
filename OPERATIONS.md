# omo claw Operations

## Start headless runtime

macOS / Linux:

```bash
cp integration/bridge-runtime/.bridge-secret.example integration/bridge-runtime/.bridge-secret
chmod 600 integration/bridge-runtime/.bridge-secret
./integration/bridge-runtime/bridge-launcher.sh
```

Windows PowerShell:

```powershell
Copy-Item .\integration\bridge-runtime\.bridge-secret.example .\integration\bridge-runtime\.bridge-secret -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File .\integration\bridge-runtime\bridge-launcher.ps1
```

## Verify runtime

1. macOS / Linux: `curl -u opencode:$(cat integration/bridge-runtime/.bridge-secret) http://127.0.0.1:19222/global/health`
2. Windows PowerShell:

   ```powershell
   $secret = (Get-Content .\integration\bridge-runtime\.bridge-secret -Raw).Trim()
   $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("opencode:$secret"))
   Invoke-RestMethod -Uri "http://127.0.0.1:19222/global/health" -Headers @{ Authorization = "Basic $token" }
   ```

3. Open `http://127.0.0.1:19222/doc`
4. Run `bun test` and `bun run typecheck`
5. Run `./tests/live/runtime-health.smoke.sh` on macOS / Linux, or `powershell -ExecutionPolicy Bypass -File .\tests\live\runtime-health.smoke.ps1` on Windows
6. Run `bun run compile:definitions`

## Rollback / cleanup

1. Stop the headless `opencode serve` process.
2. Remove `integration/bridge-runtime/.bridge-secret` if the environment is being reset.
3. Delete `integration/bridge-runtime/xdg/{config,data,state}` only for a full bridge reset.
4. Revert generated files under `definitions/generated/` if definition outputs need a clean rebuild.

## Troubleshooting

- If health never turns green, verify `OPENCODE_SERVER_PASSWORD` and `XDG_*` paths from `integration/bridge-runtime/bridge-launcher.sh` or `integration/bridge-runtime/bridge-launcher.ps1`.
- If events look cross-workspace, confirm `EventBridge` is configured with the expected `allowedDirectory`.
- If permissions hang, inspect `BridgeOrchestrator.getStatus().pendingPermissions` and apply timeout fallback.
- If compatibility drops to `safe` or `quarantine`, inspect the `capability` payload from `omo-claw.status` and compare against `compatibility/capability-snapshots/capability-baseline.json`.
- If replay output looks wrong, verify `message.part.updated`, `message.part.removed`, and `session.compacted` ordering in the incoming event trace.
