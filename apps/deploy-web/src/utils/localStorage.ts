"use client";

import { compareVersions } from "./semver";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

const migrations: Record<string, () => void> = {
  "0.14.0": () => {},
  "3.11.1": () => {
    localStorage.removeItem("unleash:repository:sessionId");
  }
};

// Store latestUpdatedVersion in localStorage
// Check if latestUpdatedVersion is < currentVersion
// If so run all the version > until current is reached.
export const migrateLocalStorage = () => {
  const currentVersion = APP_VERSION.replace(/-[\w]+$/, "");
  const version = getVersion().replace(/-[\w]+$/, "");
  const hasPreviousVersion = version && currentVersion !== version;

  if (hasPreviousVersion) {
    Object.keys(migrations).forEach(migrationVersion => {
      if (compareVersions(migrationVersion, version) > 0) {
        try {
          console.log(`Applying version ${migrationVersion}`);
          // Execute local storage migration
          migrations[migrationVersion]();
        } catch (error) {
          console.log(error);
        }
      }
    });
  }

  localStorage.setItem("latestUpdatedVersion", currentVersion);
};

function getVersion(): string {
  const latestUpdatedVersion = localStorage.getItem("latestUpdatedVersion");

  if (latestUpdatedVersion) {
    return latestUpdatedVersion;
  }

  const isOldVersionUpgrade = Object.keys(localStorage).some(key => key.endsWith(".data") || key.endsWith(".wallet"));
  if (isOldVersionUpgrade) {
    return "1.0.0";
  }

  return APP_VERSION;
}
