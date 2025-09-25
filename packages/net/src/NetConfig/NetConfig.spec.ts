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

    expect(netConfig.getFaucetUrl("sandbox")).toBe("http://faucet.sandbox-01.aksh.pw/");
    expect(netConfig.getFaucetUrl("mainnet")).toBeNull();
    expect(netConfig.getFaucetUrl("testnet-02")).toBeDefined();
  });

  function setup() {
    return new NetConfig();
  }
});
