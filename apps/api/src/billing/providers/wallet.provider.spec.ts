import { MasterWalletMnemonicService } from "@src/billing/providers/wallet.provider";

// Mock the config
const mockConfig = {
  COMPANY_MASTER_WALLET_ADDRESSES: ["akash1company1", "akash1company2", "akash1company3"],
  COMPANY_MASTER_WALLET_MNEMONICS: ["company mnemonic 1", "company mnemonic 2", "company mnemonic 3"],
  COMMUNITY_MASTER_WALLET_ADDRESSES: ["akash1community1", "akash1community2"],
  COMMUNITY_MASTER_WALLET_MNEMONICS: ["community mnemonic 1", "community mnemonic 2"]
};

// Mock the config module
jest.mock("@src/billing/config", () => ({
  config: mockConfig
}));

describe("MasterWalletMnemonicService", () => {
  let service: MasterWalletMnemonicService;

  beforeEach(() => {
    service = new MasterWalletMnemonicService();
  });

  describe("initialization", () => {
    it("should create address to mnemonic mapping correctly", () => {
      expect(service.getMnemonicByAddress("akash1company1")).toBe("company mnemonic 1");
      expect(service.getMnemonicByAddress("akash1company2")).toBe("company mnemonic 2");
      expect(service.getMnemonicByAddress("akash1company3")).toBe("company mnemonic 3");
      expect(service.getMnemonicByAddress("akash1community1")).toBe("community mnemonic 1");
      expect(service.getMnemonicByAddress("akash1community2")).toBe("community mnemonic 2");
    });

    it("should create category to addresses mapping correctly", () => {
      expect(service.getAddressesByCategory("COMPANY")).toEqual(["akash1company1", "akash1company2", "akash1company3"]);
      expect(service.getAddressesByCategory("COMMUNITY")).toEqual(["akash1community1", "akash1community2"]);
    });

    it("should return undefined for unknown address", () => {
      expect(service.getMnemonicByAddress("akash1unknown")).toBeUndefined();
    });

    it("should return empty array for unknown category", () => {
      expect(service.getAddressesByCategory("UNKNOWN")).toEqual([]);
    });
  });

  describe("getAddresses", () => {
    it("should return all wallet addresses", () => {
      const addresses = service.getAddresses();
      expect(addresses).toHaveLength(5);
      expect(addresses).toContain("akash1company1");
      expect(addresses).toContain("akash1company2");
      expect(addresses).toContain("akash1company3");
      expect(addresses).toContain("akash1community1");
      expect(addresses).toContain("akash1community2");
    });
  });

  describe("hasAddress", () => {
    it("should return true for existing addresses", () => {
      expect(service.hasAddress("akash1company1")).toBe(true);
      expect(service.hasAddress("akash1company2")).toBe(true);
      expect(service.hasAddress("akash1company3")).toBe(true);
      expect(service.hasAddress("akash1community1")).toBe(true);
      expect(service.hasAddress("akash1community2")).toBe(true);
    });

    it("should return false for non-existing addresses", () => {
      expect(service.hasAddress("akash1unknown")).toBe(false);
      expect(service.hasAddress("")).toBe(false);
    });
  });

  describe("getWalletCount", () => {
    it("should return correct wallet counts", () => {
      const counts = service.getWalletCount();
      expect(counts.company).toBe(3);
      expect(counts.community).toBe(2);
      expect(counts.total).toBe(5);
    });
  });

  describe("configuration validation", () => {
    it("should throw error when company addresses and mnemonics have different lengths", () => {
      const invalidConfig = {
        ...mockConfig,
        COMPANY_MASTER_WALLET_ADDRESSES: ["akash1company1", "akash1company2"],
        COMPANY_MASTER_WALLET_MNEMONICS: ["company mnemonic 1"] // Only 1 mnemonic for 2 addresses
      };

      jest.doMock("@src/billing/config", () => ({
        config: invalidConfig
      }));

      expect(() => new MasterWalletMnemonicService()).toThrow("Company master wallet addresses and mnemonics arrays must have the same length");
    });

    it("should throw error when community addresses and mnemonics have different lengths", () => {
      const invalidConfig = {
        ...mockConfig,
        COMMUNITY_MASTER_WALLET_ADDRESSES: ["akash1community1"],
        COMMUNITY_MASTER_WALLET_MNEMONICS: ["community mnemonic 1", "community mnemonic 2"] // 2 mnemonics for 1 address
      };

      jest.doMock("@src/billing/config", () => ({
        config: invalidConfig
      }));

      expect(() => new MasterWalletMnemonicService()).toThrow("Community master wallet addresses and mnemonics arrays must have the same length");
    });
  });

  describe("edge cases", () => {
    it("should handle empty arrays", () => {
      const emptyConfig = {
        ...mockConfig,
        COMPANY_MASTER_WALLET_ADDRESSES: [],
        COMPANY_MASTER_WALLET_MNEMONICS: [],
        COMMUNITY_MASTER_WALLET_ADDRESSES: [],
        COMMUNITY_MASTER_WALLET_MNEMONICS: []
      };

      jest.doMock("@src/billing/config", () => ({
        config: emptyConfig
      }));

      const emptyService = new MasterWalletMnemonicService();
      expect(emptyService.getAddresses()).toEqual([]);
      expect(emptyService.getAddressesByCategory("COMPANY")).toEqual([]);
      expect(emptyService.getAddressesByCategory("COMMUNITY")).toEqual([]);
      expect(emptyService.getWalletCount()).toEqual({ company: 0, community: 0, total: 0 });
    });

    it("should handle single wallet per category", () => {
      const singleWalletConfig = {
        ...mockConfig,
        COMPANY_MASTER_WALLET_ADDRESSES: ["akash1company1"],
        COMPANY_MASTER_WALLET_MNEMONICS: ["company mnemonic 1"],
        COMMUNITY_MASTER_WALLET_ADDRESSES: ["akash1community1"],
        COMMUNITY_MASTER_WALLET_MNEMONICS: ["community mnemonic 1"]
      };

      jest.doMock("@src/billing/config", () => ({
        config: singleWalletConfig
      }));

      const singleService = new MasterWalletMnemonicService();
      expect(singleService.getAddressesByCategory("COMPANY")).toEqual(["akash1company1"]);
      expect(singleService.getAddressesByCategory("COMMUNITY")).toEqual(["akash1community1"]);
      expect(singleService.getWalletCount()).toEqual({ company: 1, community: 1, total: 2 });
    });
  });
});
