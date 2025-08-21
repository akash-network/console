import { ChainConfigService } from "./chain-config.service";

describe("ChainConfigService", () => {
  describe("getBaseRpcUrl", () => {
    it("should return RPC URL based on environment configuration", () => {
      const service = new ChainConfigService();

      const rpcUrl = service.getBaseRpcUrl();
      expect(rpcUrl).toBeDefined();
      expect(typeof rpcUrl).toBe("string");
    });
  });

  describe("getBaseAPIUrl", () => {
    it("should return API URL based on environment configuration", () => {
      const service = new ChainConfigService();

      const apiUrl = service.getBaseAPIUrl();
      expect(apiUrl).toBeDefined();
      expect(typeof apiUrl).toBe("string");
    });
  });

  describe("getSupportedNetworks", () => {
    it("should return supported networks", () => {
      const service = new ChainConfigService();

      const networks = service.getSupportedNetworks();
      expect(Array.isArray(networks)).toBe(true);
      expect(networks.length).toBeGreaterThan(0);
    });
  });

  describe("getFaucetUrl", () => {
    it("should return faucet URL for sandbox", () => {
      const service = new ChainConfigService();

      const faucetUrl = service.getFaucetUrl("sandbox");
      expect(faucetUrl).toBeDefined();
      expect(typeof faucetUrl).toBe("string");
    });

    it("should return null for mainnet", () => {
      const service = new ChainConfigService();

      const faucetUrl = service.getFaucetUrl("mainnet");
      expect(faucetUrl).toBeNull();
    });

    it("should return null for testnet", () => {
      const service = new ChainConfigService();

      const faucetUrl = service.getFaucetUrl("testnet-02");
      expect(faucetUrl).toBeNull();
    });
  });
});
