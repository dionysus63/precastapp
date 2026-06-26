# Adds Windows Firewall inbound rule for Precast Ops (LAN only).
# Run as Administrator.
#
# Example:
#   .\scripts\deploy\configure-firewall.ps1 -Subnet "192.168.1.0/24"
#   .\scripts\deploy\configure-firewall.ps1 -Subnet "192.168.1.0/24" -Port 3000

param(
    [Parameter(Mandatory = $true)]
    [string] $Subnet,

    [int] $Port = 3000
)

$ErrorActionPreference = "Stop"

$ruleName = "Precast Ops (TCP $Port)"

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Firewall rule already exists: $ruleName" -ForegroundColor Yellow
    Get-NetFirewallRule -DisplayName $ruleName | Get-NetFirewallAddressFilter | Format-List
    exit 0
}

Write-Host "Creating firewall rule: $ruleName" -ForegroundColor Cyan
Write-Host "  Allow TCP $Port from $Subnet"

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -RemoteAddress $Subnet `
    -Profile Domain, Private `
    | Out-Null

Write-Host "[OK] Rule created. Office PCs on $Subnet can reach port $Port." -ForegroundColor Green
