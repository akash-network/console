import { describe, expect, it } from "vitest";

import type { AkashBlockChanges, AkashChangeBody } from "@src/akash/akash-changes";
import { collectAkashAddresses, isProviderChange } from "@src/akash/akash-changes";

const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");

describe("collectAkashAddresses", () => {
  it("collects owners, providers and depositors from deployment-keyed changes", () => {
    const addresses = collectAkashAddresses([
      block([
        { kind: "deploymentCreated", key: { owner: "akash1owner", dseq: "1" }, denom: "uakt", deposit: "1", depositor: "akash1depositor", groups: [] },
        { kind: "bidCreated", key: { owner: "akash1owner", dseq: "1", gseq: 1, oseq: 1, bseq: 0, provider: "akash1bidder" }, price: "1", priceDenom: "uakt" }
      ])
    ]);

    expect(addresses).toEqual(new Set(["akash1owner", "akash1depositor", "akash1bidder"]));
  });

  it("collects the owner and auditor from provider and audit changes", () => {
    const addresses = collectAkashAddresses([
      block([
        { kind: "providerCreated", owner: "akash1prov", hostUri: "https://x", email: null, website: null, attributes: [] },
        { kind: "providerDeleted", owner: "akash1gone" },
        { kind: "providerAttributesSigned", owner: "akash1prov", auditor: "akash1auditor", attributes: [] },
        { kind: "providerAttributesUnsigned", owner: "akash1prov", auditor: "akash1revoker", keys: [] }
      ])
    ]);

    expect(addresses).toEqual(new Set(["akash1prov", "akash1gone", "akash1auditor", "akash1revoker"]));
  });
});

describe("isProviderChange", () => {
  it("narrows provider and audit kinds and rejects deployment-keyed ones", () => {
    const provider: AkashChangeBody = { kind: "providerDeleted", owner: "akash1prov" };
    const deployment: AkashChangeBody = { kind: "deploymentClosed", key: { owner: "akash1owner", dseq: "1" } };

    expect(isProviderChange({ ...provider, txIndex: 0, msgIndex: 0 })).toBe(true);
    expect(isProviderChange({ ...deployment, txIndex: 0, msgIndex: 0 })).toBe(false);
  });
});

function block(bodies: AkashChangeBody[]): AkashBlockChanges {
  return { height: 100, datetime: BLOCK_TIME, changes: bodies.map((body, index) => ({ ...body, txIndex: 0, msgIndex: index })) };
}
