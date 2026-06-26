# Office rollout checklist

Use after the app is running as a Windows service and smoke-tested.

## 1. Server URL for the desktop app

Pick one stable address and bake it into the Electron installer:

| Option | Example |
|--------|---------|
| Hostname (preferred) | `http://precast-srv:3000` |
| IP address | `http://192.168.1.50:3000` |

Ensure office PCs resolve the hostname (DNS A record or hosts file on each PC if needed).

Build the installer:

```powershell
.\scripts\deploy\build-electron-client.ps1 -ServerUrl "http://precast-srv:3000"
```

## 2. Install Precast Ops on each PC

**Do not** give staff browser bookmarks — use the desktop app only.

1. Copy `dist/electron/Precast Ops Setup x.x.x.exe` to a share or deploy via GPO/RMM.
2. Run the installer on each staff PC.
3. Silent install (optional): `Precast Ops Setup.exe /S`
4. Pin **Precast Ops** to Start menu / taskbar.

If the server URL changes later, either rebuild the installer or edit on each PC:

`%APPDATA%\Precast Ops\config.json`

```json
{ "serverUrl": "http://precast-srv:3000" }
```

## 3. Staff expectations

Share this with the team:

### How to open the app

- Launch **Precast Ops** from the Start menu — not Chrome or Edge.
- Sign in at `/login` (pick your username).

### What works from any desk

- Quotes, jobs, customers, inventory, production queue
- Generate quote and drill-sheet PDFs (saved to job folders on the share)
- Browse and upload files in the in-app **Files** section

### “Open in Explorer” limitation

When someone clicks **Open folder** or **Open file**, Windows Explorer opens on the **app server**, not on their PC. For daily work:

- Use the in-app file browser, or
- Map the same UNC drive on their PC (e.g. `\\FILESERVER\PrecastJobs` → `J:`)

### Sessions

- Sessions expire after **8 hours**
- Sign out from the app when leaving a shared PC

## 4. Role walkthrough (recommended)

Walk one person through each role before wide rollout:

| Role | Test flow |
|------|-----------|
| Estimator | Open Precast Ops → New quote → Generate PDF → Confirm PDF on share |
| Office admin | Settings → Users → Add user |
| Production | Production queue → Record entry |
| Files | Upload to job folder → Appears in Files list |

## 5. Backups

### Database (nightly recommended)

```powershell
# Run manually once to verify
.\scripts\deploy\backup-database.ps1 -OutputDir "D:\Backups\precastapp"
```

Register a **Windows Scheduled Task**:

- **Trigger:** Daily, off-hours
- **Action:** `powershell.exe -ExecutionPolicy Bypass -File C:\Apps\precastapp\scripts\deploy\backup-database.ps1 -OutputDir D:\Backups\precastapp`
- **Run as:** account with read access to PostgreSQL (or use `.pgpass`)

Retain backups per your policy (e.g. 30 daily, 12 monthly).

### Job files

Use your existing UNC/share backup — the app does not replace NAS or file-server backups.

## 6. Support contacts

Document internally:

- Who restarts the `PrecastApp` Windows service
- Who runs server deploy updates (`docs/DEPLOYMENT.md` Phase 5)
- Who rebuilds/redeploys the Electron installer
- Where the filled [deployment-server-info.md](deployment-server-info.md) lives

## 7. Post-rollout verification (first week)

- [ ] All staff can open Precast Ops and sign in
- [ ] Each user has correct permissions (no unexpected “permission denied”)
- [ ] PDF generation works under normal load
- [ ] New job folders appear on the UNC share
- [ ] First scheduled DB backup succeeded
