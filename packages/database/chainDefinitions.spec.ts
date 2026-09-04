import { netConfig } from "@akashnetwork/net";
import { describe, expect, it } from "vitest";

import { chainDefinitions, resolveAkashSandboxChainOverride } from "./chainDefinitions";

describe("Akash sandbox chain definition", () => {
  it("preserves the standard sandbox configuration by default", () => {
    expect(chainDefinitions.akashSandbox).toMatchObject({
      chainId: "sandbox-2",
      rpcNodes: netConfig.getAllBaseRpcUrls("sandbox"),
      apiUrl: netConfig.getBaseAPIUrl("sandbox"),
      genesisFileUrl: `https://raw.githubusercontent.com/akash-network/net/main/${netConfig.mapped("sandbox")}/genesis.json`
    });
  });

  it("parses a complete private sandbox configuration", () => {
    expect(
      resolveAkashSandboxChainOverride({
        chainId: "aep-86",
        rpcUrl: "https://rpc.aep86.example.com",
        restApiUrl: "https://rest.aep86.example.com",
        genesisUrl: "https://aep86.example.com/genesis.json"
      })
    ).toEqual({
      chainId: "aep-86",
      rpcUrl: "https://rpc.aep86.example.com",
      restApiUrl: "https://rest.aep86.example.com",
      genesisUrl: "https://aep86.example.com/genesis.json"
    });
  });

  it("rejects a partial private sandbox configuration", () => {
    expect(() => resolveAkashSandboxChainOverride({ chainId: "aep-86" })).toThrow("must be set together");
  });
});
