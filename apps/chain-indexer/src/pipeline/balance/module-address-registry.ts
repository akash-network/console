import { toBech32 } from "@cosmjs/encoding";
import { createHash } from "node:crypto";

import { AKASH_ADDRESS_PREFIX } from "@src/genesis/genesis-address";

/** A recognized system account whose involvement in a coin movement identifies the movement's reason. */
export type ModuleRole =
  | "fee_collector"
  | "distribution"
  | "mint"
  | "gov"
  | "bonded_tokens_pool"
  | "not_bonded_tokens_pool"
  | "ibc_transfer"
  | "bme_vault"
  | "escrow";

/** The Akash BME vault, funded by escrow settlements and MsgMintACT and drained by burns; not a `x/auth` module account. */
export const BME_VAULT_ADDRESS = "akash1klpwzlvfnw7j8gtdd0cuu9vaw9ermsmd37sg55";

const MODULE_NAME_ROLES: Record<string, ModuleRole> = {
  fee_collector: "fee_collector",
  distribution: "distribution",
  mint: "mint",
  gov: "gov",
  bonded_tokens_pool: "bonded_tokens_pool",
  not_bonded_tokens_pool: "not_bonded_tokens_pool",
  transfer: "ibc_transfer",
  escrow: "escrow"
};

/**
 * The bech32 address of a Cosmos SDK module account: the first 20 bytes of `sha256(moduleName)`, matching
 * `authtypes.NewModuleAddress`. Derivation is deterministic, so the classifier can recognize a module
 * account without needing it seeded from genesis.
 */
export function deriveModuleAddress(moduleName: string, prefix: string): string {
  const digest = createHash("sha256").update(Buffer.from(moduleName)).digest();
  return toBech32(prefix, digest.subarray(0, 20));
}

export interface ModuleAddressRegistry {
  roleOf(address: string): ModuleRole | undefined;
}

/** Precomputes the address→role map for every known system account so reason classification is a single map lookup. */
export function buildModuleAddressRegistry(prefix: string = AKASH_ADDRESS_PREFIX): ModuleAddressRegistry {
  const roleByAddress = new Map<string, ModuleRole>();

  for (const [moduleName, role] of Object.entries(MODULE_NAME_ROLES)) {
    roleByAddress.set(deriveModuleAddress(moduleName, prefix), role);
  }
  roleByAddress.set(BME_VAULT_ADDRESS, "bme_vault");

  return {
    roleOf: address => roleByAddress.get(address)
  };
}
