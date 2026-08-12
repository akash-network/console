import { describe, expect, it } from "vitest";

import { AKASH_ADDRESS_PREFIX } from "@src/genesis/genesis-address";
import { BME_VAULT_ADDRESS, buildModuleAddressRegistry, deriveModuleAddress } from "@src/pipeline/balance/module-address-registry";

describe("deriveModuleAddress", () => {
  it("matches the well-known cosmos-hub fee collector address", () => {
    expect(deriveModuleAddress("fee_collector", "cosmos")).toBe("cosmos17xpfvakm2amg962yls6f84z3kell8c5lserqta");
  });

  it("matches the well-known cosmos-hub distribution address", () => {
    expect(deriveModuleAddress("distribution", "cosmos")).toBe("cosmos1jv65s3grqf6v6jl3dp4t6c9t9rk99cd88lyufl");
  });
});

describe("buildModuleAddressRegistry", () => {
  it("maps the derived module addresses back to their role", () => {
    const registry = buildModuleAddressRegistry(AKASH_ADDRESS_PREFIX);

    expect(registry.roleOf(deriveModuleAddress("fee_collector", AKASH_ADDRESS_PREFIX))).toBe("fee_collector");
    expect(registry.roleOf(deriveModuleAddress("bonded_tokens_pool", AKASH_ADDRESS_PREFIX))).toBe("bonded_tokens_pool");
    expect(registry.roleOf(deriveModuleAddress("not_bonded_tokens_pool", AKASH_ADDRESS_PREFIX))).toBe("not_bonded_tokens_pool");
    expect(registry.roleOf(deriveModuleAddress("transfer", AKASH_ADDRESS_PREFIX))).toBe("ibc_transfer");
  });

  it("maps the BME vault address to the bme role", () => {
    const registry = buildModuleAddressRegistry(AKASH_ADDRESS_PREFIX);

    expect(registry.roleOf(BME_VAULT_ADDRESS)).toBe("bme_vault");
  });

  it("returns undefined for a non-module address", () => {
    const registry = buildModuleAddressRegistry(AKASH_ADDRESS_PREFIX);

    expect(registry.roleOf("akash1regularuseraddressxxxxxxxxxxxxxxxxxxx")).toBeUndefined();
  });
});
