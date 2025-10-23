#!/usr/bin/env tsx

/**
 * Script to extract Leap extension's local storage from Chrome for E2E tests
 *
 * WHY THIS SCRIPT IS NEEDED:
 *
 * When running E2E tests with Playwright that interact with browser extensions like Leap Wallet,
 * we need to pre-populate the extension's local storage with authentication state and wallet data.
 * This allows tests to bypass manual wallet setup and login flows.
 *
 * However, browser extension storage (chrome.storage.local) is isolated and can only be accessed
 * from within the extension's own context - not from external scripts or Playwright automation.
 *
 * This script provides step-by-step instructions for manually extracting the storage data
 * from a properly configured Leap Wallet extension, which can then be loaded into the test
 * environment to simulate an authenticated wallet state.
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
     console.log(JSON.stringify(data, null, 2));
     console.log('\\n✓ Storage data printed above - select and copy it manually');
   });

5. Select the JSON output in the console, right-click and copy it
   
6. Paste the clipboard content into:
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
