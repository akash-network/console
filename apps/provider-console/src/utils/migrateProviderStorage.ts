import { browserEnvConfig } from "@src/config/browser-env.config";
import { mainnetId } from "@src/utils/constants";

const MIGRATION_FLAG_KEY = "providerProcessMigrationComplete";
const OLD_KEY = "providerProcess";
const BACKUP_KEY = "providerProcess_backup";

/**
 * Migrates provider process data from the old global key to wallet-scoped keys.
 * This is a one-time migration that runs on first load after the update.
 *
 * Migration strategy:
 * - Reads old data from localStorage["providerProcess"]
 * - Migrates to: localStorage["networkId/walletAddress/providerProcess"]
 * - Keeps old data as backup
 * - Only runs if wallet is connected
 */
export function migrateProviderStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Check if migration has already been completed
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
    return;
  }

  try {
    // Get wallet address from localStorage (set by WalletProvider)
    const walletAddress = localStorage.getItem("walletAddress");

    // Only migrate if wallet is connected
    if (!walletAddress) {
      return;
    }

    // Read old data
    const oldDataString = localStorage.getItem(OLD_KEY);
    if (!oldDataString) {
      // No old data to migrate, mark as complete
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
      return;
    }

    // Create backup of old data
    localStorage.setItem(BACKUP_KEY, oldDataString);

    // Build new wallet-scoped key
    const selectedNetworkId = browserEnvConfig.NEXT_PUBLIC_SELECTED_NETWORK ?? mainnetId;
    const newKey = `${selectedNetworkId}/${walletAddress}/${OLD_KEY}`;

    // Migrate data to new key
    localStorage.setItem(newKey, oldDataString);

    // Mark migration as complete
    localStorage.setItem(MIGRATION_FLAG_KEY, "true");

    console.log(`Provider process storage migrated to wallet-scoped key: ${newKey}`);
  } catch (error) {
    console.error("Failed to migrate provider process storage:", error);
    // Restore from backup if available
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      try {
        localStorage.setItem(OLD_KEY, backup);
      } catch (restoreError) {
        console.error("Failed to restore backup:", restoreError);
      }
    }
  }
}
