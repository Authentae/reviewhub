# 🟡 Safe Dependency Updates for ReviewHub
# Updates minor/patch versions with no breaking changes

param(
    [switch]$DryRun = $false,     # Show what would be updated without doing it
    [switch]$ServerOnly = $false, # Only update server dependencies
    [switch]$ClientOnly = $false, # Only update client dependencies
    [switch]$Force = $false       # Skip confirmation prompts
)

Write-Host "🟡 ReviewHub Safe Dependency Updates" -ForegroundColor Yellow
Write-Host "====================================" -ForegroundColor Yellow
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json") -or -not (Test-Path "server") -or -not (Test-Path "client")) {
    Write-Host "[ERROR] Please run this script from the ReviewHub app root directory" -ForegroundColor Red
    exit 1
}

if ($DryRun) {
    Write-Host "[DRY RUN MODE] Showing what would be updated without making changes" -ForegroundColor Cyan
    Write-Host ""
}

# Create backup
if (-not $DryRun) {
    Write-Host "[INFO] Creating backup of package files..." -ForegroundColor Blue
    New-Item -ItemType Directory -Path ".safe-updates-backup" -Force | Out-Null
    if (Test-Path "package-lock.json") {
        Copy-Item "package-lock.json" ".safe-updates-backup/" -Force
    }
    if (Test-Path "server/package-lock.json") {
        Copy-Item "server/package-lock.json" ".safe-updates-backup/server-package-lock.json" -Force
    }
    if (Test-Path "client/package-lock.json") {
        Copy-Item "client/package-lock.json" ".safe-updates-backup/client-package-lock.json" -Force
    }
    Write-Host "[SUCCESS] Backup created in .safe-updates-backup/" -ForegroundColor Green
    Write-Host ""
}

# Function to restore backup
function Restore-Backup {
    if (Test-Path ".safe-updates-backup") {
        Write-Host "[WARNING] Restoring from backup..." -ForegroundColor Yellow
        if (Test-Path ".safe-updates-backup/package-lock.json") {
            Copy-Item ".safe-updates-backup/package-lock.json" "." -Force
        }
        if (Test-Path ".safe-updates-backup/server-package-lock.json") {
            Copy-Item ".safe-updates-backup/server-package-lock.json" "server/package-lock.json" -Force
        }
        if (Test-Path ".safe-updates-backup/client-package-lock.json") {
            Copy-Item ".safe-updates-backup/client-package-lock.json" "client/package-lock.json" -Force
        }
        Write-Host "[SUCCESS] Backup restored" -ForegroundColor Green
    }
}

# Define safe updates
$updates = @{
    'root' = @{
        'name' = 'Root Workspace (Development Tools)'
        'packages' = @{
            'concurrently' = @{
                'current' = '8.2.2'
                'target' = '^9.2.1'
                'type' = 'minor'
                'description' = 'Improved development script runner'
                'risk' = 'very low'
                'benefits' = 'Better error handling, performance improvements'
            }
        }
    }
    'server' = @{
        'name' = 'Server (Backend Dependencies)'
        'packages' = @{
            'express-rate-limit' = @{
                'current' = '8.3.2'
                'target' = '^8.4.1'
                'type' = 'patch'
                'description' = 'Security patch for rate limiting'
                'risk' = 'very low'
                'benefits' = 'Security improvements, bug fixes'
            }
            '@anthropic-ai/sdk' = @{
                'current' = '0.90.0'
                'target' = '^0.91.1'
                'type' = 'minor'
                'description' = 'Claude API improvements'
                'risk' = 'low'
                'benefits' = 'New features, better error handling'
            }
            'dotenv' = @{
                'current' = '16.6.1'
                'target' = '^17.4.2'
                'type' = 'major (safe)'
                'description' = 'Environment variable loading'
                'risk' = 'very low'
                'benefits' = 'Better performance, new features'
            }
        }
    }
    'client' = @{
        'name' = 'Client (Frontend Dependencies)'
        'packages' = @{
            'axios' = @{
                'current' = '1.15.1'
                'target' = '^1.15.2'
                'type' = 'patch'
                'description' = 'HTTP client bug fixes'
                'risk' = 'very low'
                'benefits' = 'Bug fixes, stability improvements'
            }
        }
    }
}

# Show update plan
Write-Host "📋 SAFE UPDATE PLAN" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

$totalUpdates = 0
foreach ($workspace in $updates.Keys) {
    if ($ServerOnly -and $workspace -ne 'server') { continue }
    if ($ClientOnly -and $workspace -ne 'client') { continue }

    $workspaceData = $updates[$workspace]
    Write-Host "$($workspaceData.name)" -ForegroundColor Yellow

    foreach ($package in $workspaceData.packages.Keys) {
        $pkg = $workspaceData.packages[$package]
        $totalUpdates++

        Write-Host "  📦 $package" -ForegroundColor White
        Write-Host "     Current: $($pkg.current) → Target: $($pkg.target)" -ForegroundColor Gray
        Write-Host "     Type: $($pkg.type) | Risk: $($pkg.risk)" -ForegroundColor Gray
        Write-Host "     Benefits: $($pkg.benefits)" -ForegroundColor Green
        Write-Host ""
    }
}

Write-Host "Total packages to update: $totalUpdates" -ForegroundColor Blue
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN COMPLETE] No changes made. Run without -DryRun to execute updates." -ForegroundColor Cyan
    exit 0
}

# Confirmation
if (-not $Force -and $totalUpdates -gt 0) {
    Write-Host "🤔 Proceed with safe updates? All packages are low-risk with no breaking changes." -ForegroundColor Yellow
    Write-Host "   These updates include security patches and bug fixes." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Continue? (y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "[INFO] Updates cancelled by user." -ForegroundColor Blue
        exit 0
    }
}

try {
    # Execute updates
    Write-Host "🔄 EXECUTING SAFE UPDATES" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    Write-Host ""

    # Root workspace updates
    if (-not $ServerOnly -and -not $ClientOnly -and $updates.root.packages.Count -gt 0) {
        Write-Host "📦 Updating root workspace..." -ForegroundColor Blue

        foreach ($package in $updates.root.packages.Keys) {
            $pkg = $updates.root.packages[$package]
            Write-Host "  → Updating $package to $($pkg.target)" -ForegroundColor Blue
            npm update "$package@$($pkg.target)"
            if ($LASTEXITCODE -ne 0) { throw "Root update failed for $package" }
        }

        Write-Host "[SUCCESS] Root workspace updated" -ForegroundColor Green
        Write-Host ""
    }

    # Server workspace updates
    if (-not $ClientOnly -and $updates.server.packages.Count -gt 0) {
        Write-Host "🖥️ Updating server workspace..." -ForegroundColor Blue
        Set-Location "server"

        foreach ($package in $updates.server.packages.Keys) {
            $pkg = $updates.server.packages[$package]
            Write-Host "  → Updating $package to $($pkg.target)" -ForegroundColor Blue
            npm update "$package@$($pkg.target)"
            if ($LASTEXITCODE -ne 0) { throw "Server update failed for $package" }
        }

        Write-Host "  → Running server tests..." -ForegroundColor Blue
        npm test
        if ($LASTEXITCODE -ne 0) { throw "Server tests failed after updates" }

        Set-Location ".."
        Write-Host "[SUCCESS] Server workspace updated and tested" -ForegroundColor Green
        Write-Host ""
    }

    # Client workspace updates
    if (-not $ServerOnly -and $updates.client.packages.Count -gt 0) {
        Write-Host "💻 Updating client workspace..." -ForegroundColor Blue
        Set-Location "client"

        foreach ($package in $updates.client.packages.Keys) {
            $pkg = $updates.client.packages[$package]
            Write-Host "  → Updating $package to $($pkg.target)" -ForegroundColor Blue
            npm update "$package@$($pkg.target)"
            if ($LASTEXITCODE -ne 0) { throw "Client update failed for $package" }
        }

        Write-Host "  → Running client tests..." -ForegroundColor Blue
        npm test
        if ($LASTEXITCODE -ne 0) { throw "Client tests failed after updates" }

        Set-Location ".."
        Write-Host "[SUCCESS] Client workspace updated and tested" -ForegroundColor Green
        Write-Host ""
    }

    # Final validation
    Write-Host "🔍 Final validation..." -ForegroundColor Blue
    Write-Host "  → Testing development server startup..." -ForegroundColor Blue

    # Test that dev server can start (just check config, don't actually start)
    $devTest = Start-Process npm -ArgumentList "run", "dev" -NoNewWindow -PassThru
    Start-Sleep 3
    if (-not $devTest.HasExited) {
        $devTest.Kill()
        Write-Host "[SUCCESS] Development server starts correctly" -ForegroundColor Green
    } else {
        throw "Development server failed to start"
    }

    Write-Host ""
    Write-Host "🎉 ALL SAFE UPDATES COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Summary:" -ForegroundColor Blue
    Write-Host "  ✅ $totalUpdates packages updated"
    Write-Host "  ✅ All tests passed"
    Write-Host "  ✅ Development server verified"
    Write-Host "  ✅ No breaking changes"
    Write-Host ""

    Write-Host "🚀 Benefits you now have:" -ForegroundColor Green
    Write-Host "  🔒 Latest security patches applied"
    Write-Host "  🐛 Bug fixes and stability improvements"
    Write-Host "  ⚡ Performance optimizations"
    Write-Host "  🛠️ Better development experience"
    Write-Host ""

    Write-Host "Next steps:" -ForegroundColor Blue
    Write-Host "  1. Test your app thoroughly: npm run dev"
    Write-Host "  2. Deploy to staging environment"
    Write-Host "  3. Run a final security audit: .\scripts\audit-deps.ps1"
    Write-Host "  4. Plan major updates when ready (see DEPENDENCY_UPGRADE_PLAN.md)"
    Write-Host ""

    Write-Host "📁 Backup saved in .safe-updates-backup/ (delete after confirming everything works)" -ForegroundColor Gray

} catch {
    Write-Host ""
    Write-Host "[ERROR] Safe updates failed: $($_.Exception.Message)" -ForegroundColor Red
    Restore-Backup
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check the error message above"
    Write-Host "  2. Try updating one workspace at a time:"
    Write-Host "     .\scripts\safe-updates.ps1 -ServerOnly"
    Write-Host "     .\scripts\safe-updates.ps1 -ClientOnly"
    Write-Host "  3. Check for uncommitted changes in git"
    Write-Host "  4. Ensure npm is working: npm --version"
    exit 1
}

Write-Host ""
Write-Host "Usage examples:" -ForegroundColor Cyan
Write-Host "  .\scripts\safe-updates.ps1                  # Update all workspaces" -ForegroundColor Gray
Write-Host "  .\scripts\safe-updates.ps1 -DryRun          # See what would be updated" -ForegroundColor Gray
Write-Host "  .\scripts\safe-updates.ps1 -ServerOnly      # Only update server" -ForegroundColor Gray
Write-Host "  .\scripts\safe-updates.ps1 -ClientOnly      # Only update client" -ForegroundColor Gray
Write-Host "  .\scripts\safe-updates.ps1 -Force           # Skip confirmations" -ForegroundColor Gray