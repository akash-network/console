import "@src/providers";

import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ProviderInventoryRepository } from "@src/repositories/provider-inventory/provider-inventory.repository";
import type { ChainProvider } from "@src/types/chain-provider";

describe(ProviderInventoryRepository.name, () => {
  it("upserts attributes and resolves audited providers by overlapping auditors", async () => {
    const { repository } = setup();

    await repository.upsertAttributes(
      createProvider({
        owner: "akash1audited",
        hostUri: "https://audited:8443",
        signedAttributes: [
          { key: "region", value: "us-east", auditor: "akash1auditor-a" },
          { key: "tier", value: "gold", auditor: "akash1auditor-b" }
        ]
      })
    );
    await repository.upsertAttributes(
      createProvider({
        owner: "akash1unaudited",
        hostUri: "https://unaudited:8443"
      })
    );

    const audited = await repository.getAuditedProviderAddresses(["akash1auditor-a"]);
    const noneMatch = await repository.getAuditedProviderAddresses(["akash1auditor-unknown"]);
    const emptyQuery = await repository.getAuditedProviderAddresses([]);

    expect(audited).toEqual(new Set(["akash1audited"]));
    expect(noneMatch).toEqual(new Set());
    expect(emptyQuery).toEqual(new Set());
  });

  function setup() {
    return { repository: container.resolve(ProviderInventoryRepository) };
  }
});

function createProvider(overrides: Partial<ChainProvider> & Pick<ChainProvider, "owner" | "hostUri">): ChainProvider {
  return {
    selfAttributes: [],
    signedAttributes: [],
    ...overrides
  };
}
