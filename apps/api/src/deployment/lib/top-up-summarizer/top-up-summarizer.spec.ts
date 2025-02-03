import "reflect-metadata";
import "@test/mocks/logger-service.mock";

import { TopUpSummarizer } from "./top-up-summarizer";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";

jest.mock("@akashnetwork/logging");

describe(TopUpSummarizer.name, () => {
  let summarizer: TopUpSummarizer;

  beforeEach(() => {
    summarizer = new TopUpSummarizer();
  });

  describe("inc", () => {
    it("should increment counters", () => {
      summarizer.inc("deploymentCount");
      summarizer.inc("deploymentTopUpCount");
      summarizer.inc("deploymentTopUpErrorCount");
      summarizer.inc("insufficientBalanceCount");

      expect(summarizer.get("deploymentCount")).toBe(1);
      expect(summarizer.get("deploymentTopUpCount")).toBe(1);
      expect(summarizer.get("deploymentTopUpErrorCount")).toBe(1);
      expect(summarizer.get("insufficientBalanceCount")).toBe(1);
    });

    it("should increment by specified value", () => {
      summarizer.inc("deploymentCount", 2);
      expect(summarizer.get("deploymentCount")).toBe(2);
    });
  });

  describe("wallet tracking", () => {
    const WALLET_1 = AkashAddressSeeder.create();
    const WALLET_2 = AkashAddressSeeder.create();

    it("should track unique wallets", () => {
      summarizer.trackWallet(WALLET_1);
      summarizer.trackWallet(WALLET_2);
      summarizer.trackWallet(WALLET_1); // Duplicate

      expect(summarizer.get("walletsCount")).toBe(2);
    });

    it("should track successful wallets", () => {
      summarizer.trackWallet(WALLET_1);
      summarizer.trackWallet(WALLET_2);
      summarizer.trackSuccessfulWallet(WALLET_1);
      summarizer.trackSuccessfulWallet(WALLET_2);
      summarizer.trackSuccessfulWallet(WALLET_1); // Duplicate

      expect(summarizer.get("walletsCount")).toBe(2);
      expect(summarizer.get("walletsTopUpCount")).toBe(2);
    });

    it("should track failed wallets", () => {
      summarizer.trackWallet(WALLET_1);
      summarizer.trackWallet(WALLET_2);
      summarizer.trackFailedWallet(WALLET_1);
      summarizer.trackFailedWallet(WALLET_1); // Duplicate

      expect(summarizer.get("walletsCount")).toBe(2);
      expect(summarizer.get("walletsTopUpErrorCount")).toBe(1);
    });

    it("should track mixed success and failure", () => {
      summarizer.trackWallet(WALLET_1);
      summarizer.trackWallet(WALLET_2);
      summarizer.trackSuccessfulWallet(WALLET_1);
      summarizer.trackFailedWallet(WALLET_2);

      expect(summarizer.get("walletsCount")).toBe(2);
      expect(summarizer.get("walletsTopUpCount")).toBe(1);
      expect(summarizer.get("walletsTopUpErrorCount")).toBe(1);
    });
  });

  describe("addTopUpAmount", () => {
    it("should accumulate top-up amounts", () => {
      summarizer.addTopUpAmount(100);
      summarizer.addTopUpAmount(200);

      expect(summarizer.get("totalTopUpAmount")).toBe(300);
    });
  });

  describe("set", () => {
    it("should set block heights", () => {
      summarizer.set("startBlockHeight", 1000);
      summarizer.set("endBlockHeight", 2000);

      expect(summarizer.get("startBlockHeight")).toBe(1000);
      expect(summarizer.get("endBlockHeight")).toBe(2000);
    });
  });

  describe("ensurePredictedClosedHeight", () => {
    it("should track minimum predicted closed height", () => {
      summarizer.ensurePredictedClosedHeight(2000);
      summarizer.ensurePredictedClosedHeight(1000);

      expect(summarizer.get("minPredictedClosedHeight")).toBe(1000);
    });

    it("should track maximum predicted closed height", () => {
      summarizer.ensurePredictedClosedHeight(1000);
      summarizer.ensurePredictedClosedHeight(2000);

      expect(summarizer.get("maxPredictedClosedHeight")).toBe(2000);
    });

    it("should handle single height", () => {
      summarizer.ensurePredictedClosedHeight(1000);

      expect(summarizer.get("minPredictedClosedHeight")).toBe(1000);
      expect(summarizer.get("maxPredictedClosedHeight")).toBe(1000);
    });
  });

  describe("summarize", () => {
    it("should return complete summary", () => {
      const WALLET_1 = AkashAddressSeeder.create();
      const WALLET_2 = AkashAddressSeeder.create();

      summarizer.inc("deploymentCount", 2);
      summarizer.inc("deploymentTopUpCount");
      summarizer.inc("deploymentTopUpErrorCount");
      summarizer.inc("insufficientBalanceCount");
      summarizer.set("startBlockHeight", 1000);
      summarizer.set("endBlockHeight", 2000);
      summarizer.ensurePredictedClosedHeight(1500);
      summarizer.addTopUpAmount(100);

      summarizer.trackWallet(WALLET_1);
      summarizer.trackWallet(WALLET_2);
      summarizer.trackSuccessfulWallet(WALLET_1);
      summarizer.trackFailedWallet(WALLET_2);

      expect(summarizer.summarize()).toEqual({
        deploymentCount: 2,
        deploymentTopUpCount: 1,
        deploymentTopUpErrorCount: 1,
        insufficientBalanceCount: 1,
        walletsCount: 2,
        walletsTopUpCount: 1,
        walletsTopUpErrorCount: 1,
        startBlockHeight: 1000,
        endBlockHeight: 2000,
        minPredictedClosedHeight: 1500,
        maxPredictedClosedHeight: 1500,
        totalTopUpAmount: 100
      });
    });

    it("should handle empty state", () => {
      expect(summarizer.summarize()).toEqual({
        deploymentCount: 0,
        deploymentTopUpCount: 0,
        deploymentTopUpErrorCount: 0,
        insufficientBalanceCount: 0,
        walletsCount: 0,
        walletsTopUpCount: 0,
        walletsTopUpErrorCount: 0,
        startBlockHeight: undefined,
        endBlockHeight: undefined,
        minPredictedClosedHeight: undefined,
        maxPredictedClosedHeight: undefined,
        totalTopUpAmount: 0
      });
    });
  });
});
