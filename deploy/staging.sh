#!/bin/bash

# Staging Deployment Script for AI Voice Platform
# Usage: ./deploy/staging.sh

set -e

echo "=========================================="
echo "AI Voice Platform - Staging Deployment"
echo "=========================================="

# Configuration
APP_NAME="ai-voice-platform"
STAGING_DIR="/var/www/staging.$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"
GIT_REPO="."
BRANCH="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment checks
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root or with sudo"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        log_warn "PM2 is not installed. Installing..."
        npm install -g pm2
    fi
    
    log_info "Prerequisites check passed"
}

# Backup current deployment
backup_current() {
    log_info "Backing up current deployment..."
    
    if [ -d "$STAGING_DIR" ]; then
        BACKUP_NAME="$BACKUP_DIR/staging-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        cp -r "$STAGING_DIR" "$BACKUP_NAME"
        log_info "Backup created at $BACKUP_NAME"
    else
        log_warn "No existing deployment to backup"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$STAGING_DIR"
    npm ci --production=false
    npm run build
    
    log_info "Dependencies installed and build completed"
}

# Update environment configuration
update_env() {
    log_info "Updating environment configuration..."
    
    if [ -f ".env.staging" ]; then
        cp .env.staging "$STAGING_DIR/.env"
        log_info "Environment configuration updated"
    else
        log_error ".env.staging file not found"
        exit 1
    fi
}

# Restart application with PM2
restart_application() {
    log_info "Restarting application with PM2..."
    
    cd "$STAGING_DIR"
    
    # Stop existing process if running
    pm2 stop "$APP_NAME-staging" 2>/dev/null || true
    pm2 delete "$APP_NAME-staging" 2>/dev/null || true
    
    # Start new process
    pm2 start dist/server.js \
        --name "$APP_NAME-staging" \
        --env staging \
        --max-memory-restart 1G \
        --log-date-format "YYYY-MM-DD HH:mm:ss Z"
    
    pm2 save
    
    log_info "Application restarted"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    sleep 5
    
    if pm2 describe "$APP_NAME-staging" > /dev/null 2>&1; then
        STATUS=$(pm2 describe "$APP_NAME-staging" | grep "status" | awk '{print $4}')
        if [ "$STATUS" = "online" ]; then
            log_info "Application is running"
        else
            log_error "Application is not running. Status: $STATUS"
            exit 1
        fi
    else
        log_error "Application process not found"
        exit 1
    fi
}

# Main deployment flow
main() {
    log_info "Starting staging deployment..."
    
    check_prerequisites
    backup_current
    
    # Create staging directory if it doesn't exist
    mkdir -p "$STAGING_DIR"
    
    # Copy files to staging directory
    log_info "Copying files to staging directory..."
    cp -r "$GIT_REPO"/* "$STAGING_DIR/"
    
    update_env
    install_dependencies
    restart_application
    health_check
    
    log_info "Staging deployment completed successfully!"
    log_info "Application URL: https://staging.upstarloans.com"
    log_info "PM2 logs: pm2 logs $APP_NAME-staging"
}

# Run main function
main
