# Precast Ops desktop updates

This folder lives on the **server** (`C:\Apps\precastapp\public\updates`) and is served at:

**`http://192.168.1.20:3000/updates/`**

Staff Electron clients on other PCs download updates from there automatically.

## Which machine does what

| Machine | What you do |
|---------|-------------|
| **Dev PC** (`C:\Projects\precastapp`) | Build the installer and copy files to the server |
| **Server** (`C:\Apps\precastapp`) | Hosts this folder; no build required |
| **Staff PCs** | Nothing — app checks the server and prompts to restart |

## Publish a desktop update (from the dev PC)

1. On the **dev PC**, bump **`electron/package.json`** `version` (e.g. `0.1.0` → `0.1.1`).
2. Commit, push, then run:

```powershell
cd C:\Projects\precastapp
.\scripts\deploy\publish-electron-update.ps1 `
  -ServerUrl "http://192.168.1.20:3000" `
  -CopyTo "\\LIP-TITAN\C$\Apps\precastapp\public\updates"
```

3. Staff PCs pick up the update on next launch (or within ~4 hours).

**First-time setup on the server** (once):

```powershell
New-Item -ItemType Directory -Path C:\Apps\precastapp\public\updates -Force
```

## Verify (from any office PC)

```powershell
Invoke-WebRequest "http://192.168.1.20:3000/updates/latest.yml"
```

Installers are large and are **not** committed to git.
