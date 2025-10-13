#!/usr/bin/env tsx

/**
 * Script to update the Leap extension used in E2E tests
 *
 * This script copies the latest Leap Wallet extension from your Chrome profile
 * to the test fixtures directory so it can be used in Playwright tests.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "fs";
import { readdir } from "fs/promises";
import { homedir, platform } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRIPT_DIR = __dirname;
const LEAP_DIR = join(SCRIPT_DIR, "../tests/ui/fixture/Leap");

// Leap Wallet extension ID (standard ID from Chrome Web Store)
const LEAP_EXT_ID = "fcfcfllfndlomdhbehjjcoimbgofdncg";

main().catch(error => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});

async function main() {
  console.log("🔄 Updating Leap extension for E2E tests...\n");

  const chromeExtDir = getChromeExtensionDir();

  if (!existsSync(chromeExtDir)) {
    const userDataDir = getChromeUserDataDir();

    console.error(
      [
        `❌ Error: Leap extension not found at ${chromeExtDir}`,
        "",
        "Possible solutions:",
        "",
        "1. Install Leap Wallet from:",
        "   https://chrome.google.com/webstore/detail/leap-cosmos-wallet/fcfcfllfndlomdhbehjjcoimbgofdncg",
        "",
        "2. If you have Leap installed in a different Chrome profile, check:",
        `   ${userDataDir}`,
        "",
        "   Available profiles might include:",
        "   - Default",
        "   - Profile 1",
        "   - Profile 2",
        "   - Profile 3",
        "   etc...",
        "",
        `   Once found, you can manually copy the extension directory to: ${LEAP_DIR}`,
        "",
        "3. Or manually download and extract the extension to:",
        `   ${LEAP_DIR}`
      ].join("\n")
    );
    process.exit(1);
  }

  const latestVersion = await getLatestVersion(chromeExtDir);
  console.log(`📦 Found Leap extension version: ${latestVersion}`);

  const currentManifestPath = join(LEAP_DIR, "manifest.json");
  if (existsSync(currentManifestPath)) {
    const currentVersion = getVersionFromManifest(currentManifestPath);
    if (currentVersion) {
      console.log(`📌 Current test version: ${currentVersion}`);
    }
  }

  if (existsSync(LEAP_DIR)) {
    const backupDir = `${LEAP_DIR}.backup.${formatTimestamp()}`;
    console.log(`💾 Backing up current version to: ${backupDir}`);
    renameSync(LEAP_DIR, backupDir);
  }

  console.log(`📥 Copying Leap extension version ${latestVersion}...`);
  const sourceDir = join(chromeExtDir, latestVersion);

  const parentDir = dirname(LEAP_DIR);

  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  cpSync(sourceDir, LEAP_DIR, { recursive: true });

  const newManifestPath = join(LEAP_DIR, "manifest.json");

  if (existsSync(newManifestPath)) {
    const newVersion = getVersionFromManifest(newManifestPath);
    if (newVersion) {
      console.log(`✅ Successfully updated Leap extension to version: ${newVersion}`);
    } else {
      console.error("⚠️ Warning: Could not read version from manifest.json");
    }
  } else {
    console.error("❌ Error: manifest.json not found in copied extension");
    process.exit(1);
  }

  console.log("");
  console.log(`✨ Done! The tests will now use Leap extension version ${latestVersion}`);
}

function getChromeExtensionDir(): string {
  const os = platform();
  const home = homedir();

  switch (os) {
    case "darwin":
      return join(home, "Library/Application Support/Google/Chrome/Default/Extensions", LEAP_EXT_ID);
    case "linux":
      return join(home, ".config/google-chrome/Default/Extensions", LEAP_EXT_ID);
    case "win32":
      return join(home, "AppData/Local/Google/Chrome/User Data/Default/Extensions", LEAP_EXT_ID);
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }
}

function getChromeUserDataDir(): string {
  const os = platform();
  const home = homedir();

  switch (os) {
    case "darwin":
      return join(home, "Library/Application Support/Google/Chrome");
    case "linux":
      return join(home, ".config/google-chrome");
    case "win32":
      return join(home, "AppData/Local/Google/Chrome/User Data");
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }
}

async function getLatestVersion(chromeExtDir: string): Promise<string> {
  try {
    const versions = await readdir(chromeExtDir);

    if (versions.length === 0) {
      throw new Error(`No version found in ${chromeExtDir}`);
    }

    const entries = versions
      .map(name => {
        const entryPath = join(chromeExtDir, name);

        return {
          name,
          path: entryPath,
          stats: existsSync(entryPath) ? statSync(entryPath) : null
        };
      })
      .filter(entry => entry.stats?.isDirectory());

    if (entries.length === 0) {
      throw new Error(`No version directories found in ${chromeExtDir}`);
    }

    const [latestVersion] = entries.sort((a, b) => b.stats!.mtimeMs - a.stats!.mtimeMs);

    return latestVersion.name;
  } catch (error) {
    throw new Error(`Error reading versions from ${chromeExtDir}: ${error}`);
  }
}

function getVersionFromManifest(manifestPath: string): string | null {
  try {
    const manifestContent = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);
    return manifest.version || null;
  } catch {
    return null;
  }
}

function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
