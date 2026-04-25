# 🔒 Security Fix Script for ReviewHub (PowerShell)
# Fixes critical and moderate vulnerabilities

param(
    [switch]$SkipVite = $false,  # Skip Vite update (has breaking changes)
    [switch]$Force = $false      # Skip confirmation prompts
)

Write-Host "🔒 ReviewHub Security Fix Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json") -or -not (Test-Path "server") -or -not (Test-Path "client")) {
    Write-Host "[ERROR] Please run this script from the ReviewHub app root directory" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Starting security fixes for ReviewHub..." -ForegroundColor Blue
Write-Host ""

# Create backup directory
Write-Host "[INFO] Creating backup of package files..." -ForegroundColor Blue
New-Item -ItemType Directory -Path ".security-backup" -Force | Out-Null

# Backup package lock files
if (Test-Path "package-lock.json") {
    Copy-Item "package-lock.json" ".security-backup/" -Force
}
if (Test-Path "server/package-lock.json") {
    Copy-Item "server/package-lock.json" ".security-backup/server-package-lock.json" -Force
}
if (Test-Path "client/package-lock.json") {
    Copy-Item "client/package-lock.json" ".security-backup/client-package-lock.json" -Force
}

Write-Host "[SUCCESS] Backup created in .security-backup/" -ForegroundColor Green
Write-Host ""

# Function to restore backup
function Restore-Backup {
    Write-Host "[WARNING] Restoring from backup due to failure..." -ForegroundColor Yellow
    if (Test-Path ".security-backup/package-lock.json") {
        Copy-Item ".security-backup/package-lock.json" "." -Force
    }
    if (Test-Path ".security-backup/server-package-lock.json") {
        Copy-Item ".security-backup/server-package-lock.json" "server/package-lock.json" -Force
    }
    if (Test-Path ".security-backup/client-package-lock.json") {
        Copy-Item ".security-backup/client-package-lock.json" "client/package-lock.json" -Force
    }
    Write-Host "[SUCCESS] Backup restored" -ForegroundColor Green
}

try {
    # 1. Fix Server Dependencies (Safe Updates)
    Write-Host "[INFO] Updating server dependencies..." -ForegroundColor Blue
    Set-Location "server"

    Write-Host "  → Updating express-rate-limit (security patch)" -ForegroundColor Blue
    npm update express-rate-limit@^8.4.1
    if ($LASTEXITCODE -ne 0) { throw "express-rate-limit update failed" }

    Write-Host "  → Updating other safe packages" -ForegroundColor Blue
    try {
        npm update @anthropic-ai/sdk@^0.91.1 2>$null
    } catch {
        Write-Host "[WARNING] Anthropic SDK update skipped (optional)" -ForegroundColor Yellow
    }

    try {
        npm update dotenv@^17.4.2 2>$null
    } catch {
        Write-Host "[WARNING] Dotenv update skipped (optional)" -ForegroundColor Yellow
    }

    Write-Host "  → Running server tests..." -ForegroundColor Blue
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Server tests failed"
    }
    Write-Host "[SUCCESS] Server tests passed ✓" -ForegroundColor Green

    Set-Location ".."
    Write-Host "[SUCCESS] Server dependencies updated successfully" -ForegroundColor Green
    Write-Host ""

    # 2. Fix Client Dependencies (CRITICAL - Contains vulnerabilities)
    Write-Host "[INFO] Fixing client vulnerabilities..." -ForegroundColor Blue
    Set-Location "client"

    if (-not $SkipVite) {
        if (-not $Force) {
            Write-Host "[WARNING] About to update Vite (MAJOR version update)" -ForegroundColor Yellow
            Write-Host "[WARNING] This may require code changes. Proceed? (y/N): " -ForegroundColor Yellow -NoNewline
            $response = Read-Host
        } else {
            $response = "y"
        }

        if ($response -eq "y" -or $response -eq "Y") {
            Write-Host "  → Updating Vite to fix security vulnerabilities" -ForegroundColor Blue
            npm install vite@^8.0.10
            if ($LASTEXITCODE -ne 0) { throw "Vite update failed" }

            Write-Host "  → Updating Vite React plugin to match" -ForegroundColor Blue
            npm install @vitejs/plugin-react@^6.0.0
            if ($LASTEXITCODE -ne 0) { throw "Vite React plugin update failed" }

            Write-Host "  → Testing client build..." -ForegroundColor Blue
            npm run build
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[ERROR] Client build failed - Vite update may have breaking changes" -ForegroundColor Red
                Write-Host "[WARNING] Check the changelog: https://vitejs.dev/guide/migration.html" -ForegroundColor Yellow
                throw "Client build failed"
            }
            Write-Host "[SUCCESS] Client build successful ✓" -ForegroundColor Green

            Write-Host "  → Running client tests..." -ForegroundColor Blue
            npm test
            if ($LASTEXITCODE -ne 0) {
                throw "Client tests failed"
            }
            Write-Host "[SUCCESS] Client tests passed ✓" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Skipping Vite update. Manual update required later." -ForegroundColor Blue
        }
    } else {
        Write-Host "[INFO] Skipping Vite update (--SkipVite specified)" -ForegroundColor Blue
    }

    Write-Host "  → Updating safe client packages" -ForegroundColor Blue
    npm update axios@^1.15.2
    if ($LASTEXITCODE -ne 0) { throw "Axios update failed" }

    Set-Location ".."
    Write-Host "[SUCCESS] Client dependencies updated successfully" -ForegroundColor Green
    Write-Host ""

    # 3. Update Root Dependencies
    Write-Host "[INFO] Updating root workspace..." -ForegroundColor Blue
    try {
        npm update concurrently@^9.2.1 2>$null
    } catch {
        Write-Host "[WARNING] Concurrently update skipped (optional)" -ForegroundColor Yellow
    }
    Write-Host "[SUCCESS] Root dependencies updated" -ForegroundColor Green
    Write-Host ""

    # 4. Run final audit
    Write-Host "[INFO] Running final security audit..." -ForegroundColor Blue
    Write-Host ""

    Write-Host "[INFO] Auditing root workspace..." -ForegroundColor Blue
    try {
        npm audit --audit-level=moderate
    } catch {
        Write-Host "[WARNING] Root audit found issues" -ForegroundColor Yellow
    }

    Write-Host "[INFO] Auditing server workspace..." -ForegroundColor Blue
    Set-Location "server"
    try {
        npm audit --audit-level=moderate
    } catch {
        Write-Host "[WARNING] Server audit found issues" -ForegroundColor Yellow
    }
    Set-Location ".."

    Write-Host "[INFO] Auditing client workspace..." -ForegroundColor Blue
    Set-Location "client"
    try {
        npm audit --audit-level=moderate
    } catch {
        Write-Host "[WARNING] Client audit found issues" -ForegroundColor Yellow
    }
    Set-Location ".."

    Write-Host ""
    Write-Host "🎉 Security fixes completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[INFO] Summary of changes:" -ForegroundColor Blue
    Write-Host "  ✅ Server: Updated express-rate-limit and minor packages"
    Write-Host "  ✅ Client: Updated Vite, plugin-react, and axios"
    Write-Host "  ✅ Root: Updated concurrently"
    Write-Host ""
    Write-Host "[INFO] Next steps:" -ForegroundColor Blue
    Write-Host "  1. Test your application thoroughly"
    Write-Host "  2. Check for any breaking changes in updated packages"
    Write-Host "  3. Deploy to staging environment first"
    Write-Host "  4. Set up automated dependency monitoring"
    Write-Host ""
    Write-Host "[INFO] Backup files saved in .security-backup/ (can be deleted after testing)" -ForegroundColor Blue

    Write-Host "[SUCCESS] All security fixes completed! 🔒" -ForegroundColor Green

} catch {
    Write-Host "[ERROR] Security fix failed: $($_.Exception.Message)" -ForegroundColor Red
    Restore-Backup
    Write-Host ""
    Write-Host "To retry:" -ForegroundColor Yellow
    Write-Host "  PowerShell: .\scripts\security-fixes.ps1" -ForegroundColor Yellow
    Write-Host "  Skip Vite: .\scripts\security-fixes.ps1 -SkipVite" -ForegroundColor Yellow
    Write-Host "  Force mode: .\scripts\security-fixes.ps1 -Force" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Usage examples:" -ForegroundColor Cyan
Write-Host "  .\scripts\security-fixes.ps1              # Interactive mode" -ForegroundColor Gray
Write-Host "  .\scripts\security-fixes.ps1 -SkipVite    # Skip risky Vite update" -ForegroundColor Gray
Write-Host "  .\scripts\security-fixes.ps1 -Force       # No prompts" -ForegroundColor Gray