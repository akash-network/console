#!/bin/bash

# Script to update the Leap extension used in tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEAP_DIR="$SCRIPT_DIR/Leap"

# Leap Wallet extension ID (standard ID from Chrome Web Store)
LEAP_EXT_ID="fcfcfllfndlomdhbehjjcoimbgofdncg"

# Try to find Chrome extensions directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_EXT_DIR="$HOME/Library/Application Support/Google/Chrome/Profile 3/Extensions/$LEAP_EXT_ID"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CHROME_EXT_DIR="$HOME/.config/google-chrome/Default/Extensions/$LEAP_EXT_ID"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

if [ ! -d "$CHROME_EXT_DIR" ]; then
    echo "Error: Leap extension not found at $CHROME_EXT_DIR"
    echo ""
    echo "Please install Leap Wallet from: https://chrome.google.com/webstore/detail/leap-cosmos-wallet/fcfcfllfndlomdhbehjjcoimbgofdncg"
    echo ""
    echo "Or manually download and extract the extension to: $LEAP_DIR"
    exit 1
fi

# Find the latest version directory
LATEST_VERSION=$(ls -t "$CHROME_EXT_DIR" | head -1)

if [ -z "$LATEST_VERSION" ]; then
    echo "Error: No version found in $CHROME_EXT_DIR"
    exit 1
fi

echo "Found Leap extension version: $LATEST_VERSION"

# Check current version
if [ -f "$LEAP_DIR/manifest.json" ]; then
    CURRENT_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$LEAP_DIR/manifest.json" | cut -d'"' -f4)
    echo "Current test version: $CURRENT_VERSION"
fi

# Backup old version
if [ -d "$LEAP_DIR" ]; then
    BACKUP_DIR="${LEAP_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Backing up current version to: $BACKUP_DIR"
    mv "$LEAP_DIR" "$BACKUP_DIR"
fi

# Copy new version
echo "Copying Leap extension version $LATEST_VERSION..."
cp -r "$CHROME_EXT_DIR/$LATEST_VERSION" "$LEAP_DIR"

# Verify
if [ -f "$LEAP_DIR/manifest.json" ]; then
    NEW_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$LEAP_DIR/manifest.json" | cut -d'"' -f4)
    echo "✓ Successfully updated Leap extension to version: $NEW_VERSION"
else
    echo "Error: manifest.json not found in copied extension"
    exit 1
fi

echo ""
echo "Done! The tests will now use Leap extension version $NEW_VERSION"
