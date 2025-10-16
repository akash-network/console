#!/usr/bin/env tsx

/**
 * Script to extract Leap extension's local storage from Chrome for E2E tests
 *
 * This script provides instructions to manually extract the storage data
 * because chrome.storage API is only accessible from extension contexts.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractLeapStorage(): void {
  const outputPath = path.join(__dirname, "../tests/ui/fixture/leap-extension-local-storage.json");

  console.log(`
${"=".repeat(70)}
MANUAL EXTRACTION INSTRUCTIONS
${"=".repeat(70)}

To extract Leap extension's local storage:

1. Open Chrome and navigate to: chrome://extensions/

2. Enable 'Developer mode' (toggle in top-right corner)

3. Find 'Leap Cosmos Wallet' and click one of:
   - 'Inspect views: background page' (for Manifest V2)
   - 'service worker' link (for Manifest V3)

4. In the DevTools console that opens, paste and run:

   chrome.storage.local.get(null, (data) => {
     copy(JSON.stringify(data, null, 2));
     console.log('✓ Storage copied to clipboard!');
   });

5. Paste the clipboard content into:
   ${outputPath}

${"=".repeat(70)}
`);

  checkCurrentStorage(outputPath);
}

function checkCurrentStorage(outputPath: string): void {
  if (fs.existsSync(outputPath)) {
    try {
      const current = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      const keys = Object.keys(current);

      console.log(`
  Current storage file info:
  - File: ${outputPath}
  - Keys: ${keys.length}
  - Sample keys: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}
  `);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Current storage file exists but couldn't be parsed: ${message}`);
    }
  } else {
    console.log("No existing storage file found.");
  }
}

extractLeapStorage();
