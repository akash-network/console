import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SSH_PUBKEY_ENV_KEY } from "@src/types/sdlBuilder/sdlBuilder";

/**
 * Reads the SSH public key carried by a service, preferring the managed
 * `SSH_PUBKEY` env entry (the form of the key that ends up in the generated SDL)
 * and falling back to the per-service `sshPubKey` field.
 */
export function readServiceSshKey(service: ServiceType): string | undefined {
  const managedEntry = service.env?.find(entry => entry.key === SSH_PUBKEY_ENV_KEY);
  if (managedEntry) {
    return managedEntry.value || undefined;
  }
  return service.sshPubKey || undefined;
}

/**
 * Mirrors `publicKey` onto a service: sets the per-service `sshPubKey` field and
 * the managed `SSH_PUBKEY` env entry so the key shows up in the Environment
 * Variables card and the generated SDL. An empty key clears both.
 */
export function withServiceSshKey(service: ServiceType, publicKey: string): ServiceType {
  const env = (service.env ?? []).filter(entry => entry.key !== SSH_PUBKEY_ENV_KEY);
  if (publicKey) {
    env.push({ id: SSH_PUBKEY_ENV_KEY, key: SSH_PUBKEY_ENV_KEY, value: publicKey, isSecret: false });
  }
  return { ...service, sshPubKey: publicKey, env };
}

/**
 * Surfaces an imported deployment's SSH state into the form model. An SDL carries
 * the key only as a `SSH_PUBKEY` env var, so this lifts it into each service's
 * `sshPubKey` field and turns on the deployment-wide `hasSSHKey` flag. Without it
 * an imported key would be invisible and uneditable in the configure UI.
 */
export function applyImportedSshState(values: SdlBuilderFormValuesType): SdlBuilderFormValuesType {
  let hasKey = false;
  const services = values.services.map(service => {
    const key = readServiceSshKey(service);
    if (!key) {
      return service;
    }
    hasKey = true;
    return { ...service, sshPubKey: key };
  });

  return hasKey ? { ...values, services, hasSSHKey: true } : values;
}
