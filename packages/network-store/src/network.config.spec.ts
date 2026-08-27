import { netConfig } from "@akashnetwork/net";
import { describe, expect, it } from "vitest";

import { getInitialNetworksConfig, resolveAkashSandboxNetworkOverride } from "./network.config";

describe(getInitialNetworksConfig.name, () => {
  it("preserves the standard network configuration by default", () => {
    const networks = getInitialNetworksConfig({ apiBaseUrl: "/api" });

    expect(networks.map(({ chainId, rpcEndpoint }) => ({ chainId, rpcEndpoint }))).toEqual([
      { chainId: "akashnet-2", rpcEndpoint: netConfig.getBaseRpcUrl("mainnet") },
      { chainId: "sandbox-2", rpcEndpoint: netConfig.getBaseRpcUrl("sandbox") },
      { chainId: "testnet-8", rpcEndpoint: "" }
    ]);
  });

  it("overrides only the Akash sandbox network", () => {
    const akashSandboxOverride = resolveAkashSandboxNetworkOverride({
      chainId: "aep-86",
      rpcUrl: "https://rpc.aep86.example.com",
      restApiUrl: "https://rest.aep86.example.com",
      genesisUrl: "https://aep86.example.com/genesis.json"
    });
    const networks = getInitialNetworksConfig({ apiBaseUrl: "/api", akashSandboxOverride });

    expect(networks[0]).toMatchObject({ chainId: "akashnet-2", rpcEndpoint: netConfig.getBaseRpcUrl("mainnet") });
    expect(networks[1]).toMatchObject({ chainId: "aep-86", rpcEndpoint: "https://rpc.aep86.example.com" });
    expect(networks[2]).toMatchObject({ chainId: "testnet-8", rpcEndpoint: "" });
  });
});

describe(resolveAkashSandboxNetworkOverride.name, () => {
  it("rejects a partial override", () => {
    expect(() =>
      resolveAkashSandboxNetworkOverride({
        chainId: "aep-86",
        rpcUrl: "https://rpc.aep86.example.com"
      })
    ).toThrow("must be set together");
  });

  it("rejects non-HTTP endpoints", () => {
    expect(() =>
      resolveAkashSandboxNetworkOverride({
        chainId: "aep-86",
        rpcUrl: "tcp://rpc.aep86.example.com",
        restApiUrl: "https://rest.aep86.example.com",
        genesisUrl: "https://aep86.example.com/genesis.json"
      })
    ).toThrow("NEXT_PUBLIC_AKASH_SANDBOX_RPC_URL must use http or https");
  });
});
