import { MAINNET_ID, SANDBOX_ID } from "@akashnetwork/chain-sdk/web";
import { netConfig } from "@akashnetwork/net";
import { describe, expect, it } from "vitest";

import networkStore from "@src/store/networkStore";
import { resolveChainApiBaseUrl, ServicesProvider, useServices } from "./ServicesProvider";

import { render, screen } from "@testing-library/react";

describe(ServicesProvider.name, () => {
  it("exposes the chain api base url on the very first render", () => {
    setup();

    expect(screen.getByTestId("chain-api-base-url")).toHaveTextContent(netConfig.getBaseAPIUrl(networkStore.selectedNetworkId));
  });

  it("uses the private REST endpoint for an overridden sandbox", () => {
    const baseUrl = resolveChainApiBaseUrl({
      networkId: SANDBOX_ID,
      akashSandboxOverride: {
        chainId: "aep-86",
        rpcUrl: "https://rpc.aep86.example.com",
        restApiUrl: "https://rest.aep86.example.com",
        genesisUrl: "https://aep86.example.com/genesis.json"
      }
    });

    expect(baseUrl).toBe("https://rest.aep86.example.com");
  });

  it("does not apply the sandbox override to mainnet", () => {
    const baseUrl = resolveChainApiBaseUrl({
      networkId: MAINNET_ID,
      akashSandboxOverride: {
        chainId: "aep-86",
        rpcUrl: "https://rpc.aep86.example.com",
        restApiUrl: "https://rest.aep86.example.com",
        genesisUrl: "https://aep86.example.com/genesis.json"
      }
    });

    expect(baseUrl).toBe(netConfig.getBaseAPIUrl(MAINNET_ID));
  });

  function setup() {
    render(
      <ServicesProvider>
        <ChainApiBaseUrlProbe />
      </ServicesProvider>
    );
  }
});

function ChainApiBaseUrlProbe() {
  const { chainApiHttpClient } = useServices();
  return <span data-testid="chain-api-base-url">{chainApiHttpClient.defaults.baseURL}</span>;
}
