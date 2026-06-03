import { MsgLeaseStartReclaim } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TYPE_REGISTRY } from "./type-registry.provider";

describe("TYPE_REGISTRY", () => {
  it("registers MsgLeaseStartReclaim and round-trips a populated value", () => {
    const registry = container.resolve(TYPE_REGISTRY);
    const typeUrl = "/akash.market.v1beta5.MsgLeaseStartReclaim";

    expect(registry.lookupType(typeUrl)).toBeDefined();

    const value = MsgLeaseStartReclaim.fromPartial({
      id: { owner: "akash1test", dseq: "100", gseq: 1, oseq: 1, provider: "akash1prov" },
      reason: 1
    });
    const bytes = registry.encode({ typeUrl, value });
    const decoded = registry.decode({ typeUrl, value: bytes }) as MsgLeaseStartReclaim;

    expect(decoded.id?.owner).toBe("akash1test");
    expect(decoded.id?.provider).toBe("akash1prov");
    expect(decoded.id?.gseq).toBe(1);
    expect(decoded.id?.oseq).toBe(1);
    expect(decoded.reason).toBe(1);
  });
});
