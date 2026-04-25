# 🔍 Quick Dependency Audit Script for ReviewHub
# Run security audit across all workspaces

param(
    [string]$Level = "moderate",  # low, moderate, high, critical
    [switch]$Detailed = $false,   # Show detailed vulnerability info
    [switch]$FixMode = $false     # Suggest fixes
)

Write-Host "🔍 ReviewHub Dependency Security Audit" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json") -or -not (Test-Path "server") -or -not (Test-Path "client")) {
    Write-Host "[ERROR] Please run this script from the ReviewHub app root directory" -ForegroundColor Red
    exit 1
}

$ErrorCount = 0
$WarningCount = 0
$TotalVulns = 0

# Function to audit a workspace
function Audit-Workspace {
    param(
        [string]$Path,
        [string]$Name
    )

    Write-Host "🔍 Auditing $Name..." -ForegroundColor Blue
    Write-Host "Path: $Path" -ForegroundColor Gray

    if (-not (Test-Path "$Path/package.json")) {
        Write-Host "[SKIP] No package.json found" -ForegroundColor Yellow
        return
    }

    Push-Location $Path

    try {
        # Run npm audit
        $auditOutput = npm audit --audit-level=$Level --json 2>$null | ConvertFrom-Json

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] No $Level+ vulnerabilities found ✓" -ForegroundColor Green
        } else {
            $vulns = $auditOutput.metadata.vulnerabilities
            $script:TotalVulns += $vulns.total

            if ($vulns.critical -gt 0 -or $vulns.high -gt 0) {
                $script:ErrorCount++
                Write-Host "[CRITICAL] $($vulns.critical) critical, $($vulns.high) high vulnerabilities" -ForegroundColor Red
            } elseif ($vulns.moderate -gt 0) {
                $script:WarningCount++
                Write-Host "[WARNING] $($vulns.moderate) moderate vulnerabilities" -ForegroundColor Yellow
            }

            if ($vulns.low -gt 0) {
                Write-Host "[INFO] $($vulns.low) low vulnerabilities" -ForegroundColor Blue
            }

            Write-Host "Total vulnerabilities: $($vulns.total)" -ForegroundColor Gray

            if ($Detailed) {
                Write-Host ""
                Write-Host "Vulnerable packages:" -ForegroundColor Yellow
                foreach ($vuln in $auditOutput.vulnerabilities.PSObject.Properties) {
                    $v = $vuln.Value
                    Write-Host "  • $($v.name) - $($v.severity) - $($v.via[0].title)" -ForegroundColor Gray
                }
            }
        }

        # Check for outdated packages
        $outdated = npm outdated --json 2>$null
        if ($LASTEXITCODE -ne 0 -and $outdated) {
            $outdatedPkgs = $outdated | ConvertFrom-Json
            $outdatedCount = ($outdatedPkgs.PSObject.Properties | Measure-Object).Count
            Write-Host "[INFO] $outdatedCount packages have updates available" -ForegroundColor Blue

            if ($Detailed) {
                Write-Host "Outdated packages:" -ForegroundColor Blue
                foreach ($pkg in $outdatedPkgs.PSObject.Properties) {
                    $p = $pkg.Value
                    $updateType = if ($p.current.Split('.')[0] -ne $p.latest.Split('.')[0]) { "MAJOR" }
                                  elseif ($p.current.Split('.')[1] -ne $p.latest.Split('.')[1]) { "MINOR" }
                                  else { "PATCH" }
                    Write-Host "  • $($pkg.Name): $($p.current) → $($p.latest) ($updateType)" -ForegroundColor Gray
                }
            }
        }

    } catch {
        Write-Host "[ERROR] Audit failed: $($_.Exception.Message)" -ForegroundColor Red
        $script:ErrorCount++
    } finally {
        Pop-Location
    }

    Write-Host ""
}

# Audit all workspaces
Audit-Workspace "." "Root Workspace"
Audit-Workspace "server" "Server (Backend)"
Audit-Workspace "client" "Client (Frontend)"

# Summary
Write-Host "📊 AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host "Total vulnerabilities: $TotalVulns" -ForegroundColor $(if ($TotalVulns -gt 0) { "Yellow" } else { "Green" })
Write-Host "Workspaces with issues: $ErrorCount critical, $WarningCount warnings" -ForegroundColor $(if ($ErrorCount -gt 0) { "Red" } elseif ($WarningCount -gt 0) { "Yellow" } else { "Green" })

if ($TotalVulns -gt 0) {
    Write-Host ""
    Write-Host "🔧 RECOMMENDED ACTIONS:" -ForegroundColor Yellow
    Write-Host "1. Review vulnerabilities above" -ForegroundColor Gray
    Write-Host "2. Run security fixes: .\scripts\security-fixes.ps1" -ForegroundColor Gray
    Write-Host "3. Check detailed report: .\DEPENDENCY_SECURITY_AUDIT.md" -ForegroundColor Gray
    Write-Host "4. Test after updates" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "🎉 All clear! No vulnerabilities found at $Level level." -ForegroundColor Green
    Write-Host "💡 Consider running with -Level low for complete scan" -ForegroundColor Blue
}

if ($FixMode -and $TotalVulns -gt 0) {
    Write-Host ""
    Write-Host "🛠️ QUICK FIX MODE" -ForegroundColor Cyan
    Write-Host "Run security fixes now? (y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host

    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Running security fixes..." -ForegroundColor Blue
        & ".\scripts\security-fixes.ps1"
    }
}

Write-Host ""
Write-Host "Usage examples:" -ForegroundColor Cyan
Write-Host "  .\scripts\audit-deps.ps1                    # Standard audit" -ForegroundColor Gray
Write-Host "  .\scripts\audit-deps.ps1 -Level critical   # Only critical/high" -ForegroundColor Gray
Write-Host "  .\scripts\audit-deps.ps1 -Detailed         # Show all details" -ForegroundColor Gray
Write-Host "  .\scripts\audit-deps.ps1 -FixMode          # Audit + offer to fix" -ForegroundColor Gray

exit $(if ($ErrorCount -gt 0) { 1 } else { 0 })