import type { Registry } from "@cosmjs/proto-signing";
import type { FactoryProvider } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { RegistryProvider } from "./registry.provider";

describe("RegistryProvider", () => {
  it("registers AEP-86 transaction types from the expanded SDK barrel", () => {
    const registry = (RegistryProvider as FactoryProvider<Registry>).useFactory();

    expect(registry.lookupType("/akash.verification.v1.MsgSubmitAttestation")).toBeDefined();
  });
});
