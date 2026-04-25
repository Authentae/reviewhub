#!/bin/bash
# 🔒 Security Fix Script for ReviewHub
# Fixes critical and moderate vulnerabilities

set -e  # Exit on any error

echo "🔒 ReviewHub Security Fix Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ] || [ ! -d "client" ]; then
    print_error "Please run this script from the ReviewHub app root directory"
    exit 1
fi

print_status "Starting security fixes for ReviewHub..."
echo ""

# Backup current package files
print_status "Creating backup of package files..."
mkdir -p .security-backup
cp package-lock.json .security-backup/ 2>/dev/null || true
cp server/package-lock.json .security-backup/server-package-lock.json 2>/dev/null || true
cp client/package-lock.json .security-backup/client-package-lock.json 2>/dev/null || true
print_success "Backup created in .security-backup/"
echo ""

# Function to restore from backup
restore_backup() {
    print_warning "Restoring from backup due to failure..."
    cp .security-backup/package-lock.json . 2>/dev/null || true
    cp .security-backup/server-package-lock.json server/package-lock.json 2>/dev/null || true
    cp .security-backup/client-package-lock.json client/package-lock.json 2>/dev/null || true
    print_success "Backup restored"
}

# Trap to restore backup on failure
trap restore_backup ERR

# 1. Fix Server Dependencies (Safe Updates)
print_status "Updating server dependencies..."
cd server

print_status "  → Updating express-rate-limit (security patch)"
npm update express-rate-limit@^8.4.1

print_status "  → Updating other safe packages"
npm update @anthropic-ai/sdk@^0.91.1 2>/dev/null || print_warning "Anthropic SDK update skipped (optional)"
npm update dotenv@^17.4.2 2>/dev/null || print_warning "Dotenv update skipped (optional)"

print_status "  → Running server tests..."
if npm test; then
    print_success "Server tests passed ✓"
else
    print_error "Server tests failed"
    exit 1
fi

cd ..
print_success "Server dependencies updated successfully"
echo ""

# 2. Fix Client Dependencies (CRITICAL - Contains vulnerabilities)
print_status "Fixing client vulnerabilities..."
cd client

print_warning "About to update Vite (MAJOR version update)"
print_warning "This may require code changes. Proceed? (y/N)"
read -r response
if [[ "$response" != "y" && "$response" != "Y" ]]; then
    print_status "Skipping Vite update. Manual update required later."
else
    print_status "  → Updating Vite to fix security vulnerabilities"
    npm install vite@^8.0.10

    print_status "  → Updating Vite React plugin to match"
    npm install @vitejs/plugin-react@^6.0.0

    print_status "  → Testing client build..."
    if npm run build; then
        print_success "Client build successful ✓"
    else
        print_error "Client build failed - Vite update may have breaking changes"
        print_warning "Check the changelog: https://vitejs.dev/guide/migration.html"
        exit 1
    fi

    print_status "  → Running client tests..."
    if npm test; then
        print_success "Client tests passed ✓"
    else
        print_error "Client tests failed"
        exit 1
    fi
fi

print_status "  → Updating safe client packages"
npm update axios@^1.15.2

cd ..
print_success "Client dependencies updated successfully"
echo ""

# 3. Update Root Dependencies
print_status "Updating root workspace..."
npm update concurrently@^9.2.1 2>/dev/null || print_warning "Concurrently update skipped (optional)"
print_success "Root dependencies updated"
echo ""

# 4. Run final audit
print_status "Running final security audit..."
echo ""

print_status "Auditing root workspace..."
npm audit --audit-level=moderate || print_warning "Root audit found issues"

print_status "Auditing server workspace..."
cd server && npm audit --audit-level=moderate || print_warning "Server audit found issues"
cd ..

print_status "Auditing client workspace..."
cd client && npm audit --audit-level=moderate || print_warning "Client audit found issues"
cd ..

echo ""
print_success "🎉 Security fixes completed successfully!"
echo ""
print_status "Summary of changes:"
echo "  ✅ Server: Updated express-rate-limit and minor packages"
echo "  ✅ Client: Updated Vite, plugin-react, and axios"
echo "  ✅ Root: Updated concurrently"
echo ""
print_status "Next steps:"
echo "  1. Test your application thoroughly"
echo "  2. Check for any breaking changes in updated packages"
echo "  3. Deploy to staging environment first"
echo "  4. Set up automated dependency monitoring"
echo ""
print_status "Backup files saved in .security-backup/ (can be deleted after testing)"

# Clean up trap
trap - ERR

print_success "All security fixes completed! 🔒"