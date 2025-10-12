#!/bin/bash

# Script to update the Leap extension local storage JSON used in tests
# This extracts the storage from your Chrome browser's Leap extension

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/leapExtensionLocalStorage.json"

echo "To update the Leap extension local storage:"
echo ""
echo "1. Open Chrome with Leap extension installed"
echo "2. Open DevTools (F12) on any page"
echo "3. Run this in the console:"
echo ""
echo "chrome.storage.local.get(null, (data) => {"
echo "  const json = JSON.stringify(data, null, 2);"
echo "  const blob = new Blob([json], {type: 'application/json'});"
echo "  const url = URL.createObjectURL(blob);"
echo "  const a = document.createElement('a');"
echo "  a.href = url;"
echo "  a.download = 'leapExtensionLocalStorage.json';"
echo "  a.click();"
echo "});"
echo ""
echo "4. Move the downloaded file to: $OUTPUT_FILE"
echo ""