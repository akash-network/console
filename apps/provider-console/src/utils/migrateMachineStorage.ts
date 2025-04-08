/**
 * Migrates control machines to use keyfile instead of file for base64 content
 * Run this once on application startup
 */
export function migrateControlMachineStorage() {
  try {
    const storageKey = "controlMachines";
    const storedJson = localStorage.getItem(storageKey);
    if (!storedJson) return;

    const storedMachines = JSON.parse(storedJson);
    let migrationPerformed = false;

    // Check each machine
    Object.keys(storedMachines).forEach(address => {
      const machine = storedMachines[address];
      if (!machine?.access) return;

      // Check if access.file contains a base64 string
      if (
        machine.access.file &&
        typeof machine.access.file === "string" &&
        (machine.access.file.startsWith("data:") || machine.access.file.match(/^[A-Za-z0-9+/=]+$/))
      ) {
        console.log(`Migrating control machine ${address} from file to keyfile property`);
        // Move to keyfile property
        machine.access.keyfile = machine.access.file;
        delete machine.access.file; // Remove the file property entirely
        migrationPerformed = true;
      }
    });

    // Save if changes were made
    if (migrationPerformed) {
      localStorage.setItem(storageKey, JSON.stringify(storedMachines));
      console.log("Successfully migrated control machines to use keyfile property");
    }
  } catch (error) {
    console.error("Migration error:", error);
  }
}
