import { describe, expect, it } from "vitest";

import { netConfigData } from "../generated/netConfigData";
import { NetConfig, type SupportedChainNetworks } from "./NetConfig";

describe("NetConfig", () => {
  it.each(Object.keys(netConfigData))("provides base API URL for chain network '%s'", network => {
    const netConfig = setup();
    expect(netConfig.getBaseAPIUrl(network as SupportedChainNetworks)).toBeDefined();
  });

  it("returns supported networks", () => {
    const netConfig = setup();
    const allNetworks = Object.keys(netConfigData);
    const hasSupportedNetworks = netConfig.getSupportedNetworks().every(network => allNetworks.includes(network));

    expect(hasSupportedNetworks).toBe(true);
  });

  it("returns faucet URL for sandbox network", () => {
    const netConfig = setup();

    expect(netConfig.getFaucetUrl("sandbox-2")).toBe("http://faucet.sandbox-2.aksh.pw/");
    expect(netConfig.getFaucetUrl("mainnet")).toBeNull();
  });

  function setup() {
    return new NetConfig();
  }
});
