#!/usr/bin/env node

/**
 * Script to extract Leap extension's local storage from Chrome
 *
 * This script provides instructions to manually extract the storage data
 * because chrome.storage API is only accessible from extension contexts.
 */

const fs = require("fs");
const path = require("path");

function extractLeapStorage() {
  const outputPath = path.join(__dirname, "leapExtensionLocalStorage.json");

  console.log("=".repeat(70));
  console.log("MANUAL EXTRACTION INSTRUCTIONS");
  console.log("=".repeat(70));
  console.log("");
  console.log("To extract Leap extension's local storage:");
  console.log("");
  console.log("1. Open Chrome and navigate to: chrome://extensions/");
  console.log("");
  console.log("2. Enable 'Developer mode' (toggle in top-right corner)");
  console.log("");
  console.log("3. Find 'Leap Cosmos Wallet' and click one of:");
  console.log("   - 'Inspect views: background page' (for Manifest V2)");
  console.log("   - 'service worker' link (for Manifest V3)");
  console.log("");
  console.log("4. In the DevTools console that opens, paste and run:");
  console.log("");
  console.log("   chrome.storage.local.get(null, (data) => {");
  console.log("     copy(JSON.stringify(data, null, 2));");
  console.log("     console.log('✓ Storage copied to clipboard!');");
  console.log("   });");
  console.log("");
  console.log("5. Paste the clipboard content into:");
  console.log(`   ${outputPath}`);
  console.log("");
  console.log("=".repeat(70));
  console.log("");

  checkCurrentStorage(outputPath);
}

function checkCurrentStorage(outputPath) {
  if (fs.existsSync(outputPath)) {
    try {
      const current = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      const keys = Object.keys(current);

      console.log("Current storage file info:");
      console.log(`  - File: ${outputPath}`);
      console.log(`  - Keys: ${keys.length}`);
      console.log(`  - Sample keys: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}`);
      console.log("");
    } catch (error) {
      console.log(`Current storage file exists but couldn't be parsed: ${error.message}`);
      console.log("");
    }
  } else {
    console.log("No existing storage file found.");
    console.log("");
  }
}

extractLeapStorage();
