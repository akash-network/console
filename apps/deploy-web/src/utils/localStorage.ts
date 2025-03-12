"use client";

import getConfig from "next/config";
import { gt, neq } from "semver";

const { publicRuntimeConfig } = getConfig();

const migrations: Record<string, () => void> = {
  "0.14.0": () => {}
};

// Store latestUpdatedVersion in localStorage
// Check if latestUpdatedVersion is < currentVersion
// If so run all the version > until current is reached.
export const migrateLocalStorage = () => {
  const currentVersion: string = publicRuntimeConfig.version;
  const version = getVersion();
  const hasPreviousVersion = version && neq(currentVersion, version);

  if (hasPreviousVersion) {
    Object.keys(migrations).forEach(migrationVersion => {
      if (gt(migrationVersion, version)) {
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

  return publicRuntimeConfig.version;
}
