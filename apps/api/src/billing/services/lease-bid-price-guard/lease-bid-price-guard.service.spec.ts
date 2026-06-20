import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { Bid } from "@akashnetwork/http-sdk";
import type { BidHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { LoggerService } from "@src/core";
import { LeaseBidPriceGuardService } from "./lease-bid-price-guard.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBid } from "@test/seeders/bid.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const OWNER = "akash1owner";
const ACCEPTED = { dseq: "111", gseq: 1, oseq: 1, bseq: 1, provider: "akash1prov" };

describe(LeaseBidPriceGuardService.name, () => {
  describe("relative limit", () => {
    it("blocks the lease and alerts when the accepted bid reaches the block multiple of the cheapest competing bid", async () => {
      const { service, logger } = setup({
        bids: [pricedBid(ACCEPTED, 9_519_658), pricedBid({ ...ACCEPTED, provider: "akash1cheap", bseq: 2 }, 4.81)]
      });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("cheapest competing bid")
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "LEASE_BLOCKED_EXCESSIVE_BID_PRICE", reason: "relative", provider: "akash1prov", denom: "uakt" })
      );
    });

    it("allows but warns when the accepted bid is between the warn and block multiples", async () => {
      const { service, logger } = setup({
        warnMultiplier: 5,
        blockMultiplier: 10,
        bids: [pricedBid(ACCEPTED, 600), pricedBid({ ...ACCEPTED, provider: "akash1cheap", bseq: 2 }, 100)]
      });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_BID_PRICE_WARNING", ratio: 6 }));
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("allows silently when the accepted bid is below the warn multiple", async () => {
      const { service, logger } = setup({
        bids: [pricedBid(ACCEPTED, 300), pricedBid({ ...ACCEPTED, provider: "akash1cheap", bseq: 2 }, 100)]
      });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).resolves.toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("allows when the accepted bid is the cheapest on the order", async () => {
      const { service } = setup({
        bids: [pricedBid(ACCEPTED, 100), pricedBid({ ...ACCEPTED, provider: "akash1other", bseq: 2 }, 9_000_000)]
      });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).resolves.toBeUndefined();
    });
  });

  describe("absolute limit", () => {
    it("blocks a sole bidder priced above the per-denom ceiling", async () => {
      const { service, logger } = setup({ absoluteMaxUakt: 1000, bids: [pricedBid(ACCEPTED, 2000)] });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).rejects.toMatchObject({ status: 403 });
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_BLOCKED_EXCESSIVE_BID_PRICE", reason: "absolute" }));
    });

    it("allows a sole bidder priced below the per-denom ceiling", async () => {
      const { service } = setup({ absoluteMaxUakt: 1000, bids: [pricedBid(ACCEPTED, 500)] });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).resolves.toBeUndefined();
    });

    it("allows a sole bidder at any price when no ceiling is configured for the denom", async () => {
      const { service } = setup({ absoluteMaxUakt: undefined, bids: [pricedBid(ACCEPTED, 9_519_658)] });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).resolves.toBeUndefined();
    });

    it("applies the ceiling independently of the relative check when peers exist", async () => {
      const { service, logger } = setup({
        absoluteMaxUakt: 300,
        bids: [pricedBid(ACCEPTED, 400), pricedBid({ ...ACCEPTED, provider: "akash1cheap", bseq: 2 }, 100)]
      });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).rejects.toMatchObject({ status: 403 });
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ reason: "absolute" }));
    });

    it("uses the uact ceiling for uact-denominated bids", async () => {
      const { service } = setup({ absoluteMaxUact: 1000, bids: [pricedBid(ACCEPTED, 2000, "uact")] });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("guard activation", () => {
    it("is a no-op and skips fetching bids when the guard is disabled", async () => {
      const { service, bidHttpService } = setup({ enabled: false, bids: [pricedBid(ACCEPTED, 9_519_658)] });

      await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).resolves.toBeUndefined();
      expect(bidHttpService.list).not.toHaveBeenCalled();
    });

    it("is a no-op when there are no lease messages", async () => {
      const { service, bidHttpService } = setup({});

      await expect(service.validateLeaseBidPrices([deploymentMessage()], createUserWallet())).resolves.toBeUndefined();
      expect(bidHttpService.list).not.toHaveBeenCalled();
    });
  });

  it("rejects with 403 when the referenced bid cannot be resolved", async () => {
    const { service } = setup({ bids: [pricedBid({ ...ACCEPTED, provider: "akash1other" }, 100)] });

    await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("Referenced lease bid not found")
    });
  });

  it("rejects with 403 when the bid owner does not match the lease message owner", async () => {
    const foreignBid = createBid({ owner: "akash1someoneelse", ...ACCEPTED });
    foreignBid.bid.price = { denom: "uakt", amount: "100" };
    const { service } = setup({ bids: [foreignBid] });

    await expect(service.validateLeaseBidPrices([leaseMessage(ACCEPTED)], createUserWallet())).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("Referenced lease bid not found")
    });
  });

  it("evaluates each order independently and blocks the offending one", async () => {
    const cheapOrder = { dseq: "111", gseq: 1, oseq: 1, bseq: 1, provider: "akash1prov" };
    const absurdOrder = { dseq: "111", gseq: 2, oseq: 1, bseq: 1, provider: "akash1prov" };
    const { service, logger } = setup({
      bids: [
        pricedBid(cheapOrder, 100),
        pricedBid({ ...cheapOrder, provider: "akash1peer", bseq: 2 }, 100),
        pricedBid(absurdOrder, 9_519_658),
        pricedBid({ ...absurdOrder, provider: "akash1peer", bseq: 2 }, 4.81)
      ]
    });

    await expect(service.validateLeaseBidPrices([leaseMessage(cheapOrder), leaseMessage(absurdOrder)], createUserWallet())).rejects.toMatchObject({
      status: 403
    });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ reason: "relative", gseq: 2 }));
  });

  function pricedBid(ids: { dseq: string; gseq: number; oseq: number; bseq: number; provider: string }, amount: number, denom = "uakt"): Bid {
    const bid = createBid({ owner: OWNER, ...ids });
    bid.bid.price = { denom, amount: amount.toString() };
    return bid;
  }

  function leaseMessage(bidId: { dseq: string; gseq: number; oseq: number; bseq: number; provider: string }): EncodeObject {
    return {
      typeUrl: `/${MsgCreateLease.$type}`,
      value: MsgCreateLease.fromPartial({ bidId: { owner: OWNER, ...bidId } })
    };
  }

  function deploymentMessage(): EncodeObject {
    return { typeUrl: `/${MsgCreateDeployment.$type}`, value: MsgCreateDeployment.fromPartial({}) };
  }

  function setup(input: {
    enabled?: boolean;
    warnMultiplier?: number;
    blockMultiplier?: number;
    absoluteMaxUakt?: number;
    absoluteMaxUact?: number;
    bids?: Bid[];
  }) {
    const config = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_BID_PRICE_GUARD_ENABLED: input.enabled ?? true,
      MANAGED_WALLET_BID_PRICE_WARN_MULTIPLIER: input.warnMultiplier ?? 5,
      MANAGED_WALLET_BID_PRICE_BLOCK_MULTIPLIER: input.blockMultiplier ?? 10,
      MANAGED_WALLET_BID_PRICE_ABSOLUTE_MAX_UAKT: input.absoluteMaxUakt,
      MANAGED_WALLET_BID_PRICE_ABSOLUTE_MAX_UACT: input.absoluteMaxUact
    });
    const bidHttpService = mock<BidHttpService>();
    bidHttpService.list.mockResolvedValue(input.bids ?? []);
    const logger = mock<LoggerService>();
    const service = new LeaseBidPriceGuardService(config, bidHttpService, logger);
    return { service, config, bidHttpService, logger };
  }
});
