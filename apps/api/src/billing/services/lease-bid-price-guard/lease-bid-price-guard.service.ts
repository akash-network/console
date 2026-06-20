import { Bid, BidHttpService } from "@akashnetwork/http-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { resolveLeaseBids } from "@src/billing/lib/lease-messages/lease-messages";
import type { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LoggerService } from "@src/core";

/**
 * Guards managed-wallet lease creation against absurdly-overpriced bids.
 *
 * A managed wallet pays for leases out of the shared funding (master) wallet, so a provider that
 * sets a price-per-block far above the market can drain it. The chain message that opens a lease
 * (MsgCreateLease) only references a bid, carrying no price, so the only place to catch this before
 * broadcasting is here — by re-fetching the order's bids and comparing the accepted bid against its
 * peers.
 *
 * Two checks:
 *  - Relative: block when the accepted bid is far above the cheapest competing bid for the same
 *    order (apples-to-apples — same resources, denom and moment). Only applied when peers exist.
 *  - Absolute: block when the per-block price exceeds a configured per-denom ceiling. Covers the
 *    sole-bidder case where there is no peer to compare against.
 *
 * Prices moderately above the norm are allowed but logged at warn level for visibility. All
 * thresholds are configurable and the guard can be disabled entirely.
 */
@singleton()
export class LeaseBidPriceGuardService {
  constructor(
    private readonly config: BillingConfigService,
    private readonly bidHttpService: BidHttpService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(LeaseBidPriceGuardService.name);
  }

  @Trace()
  async validateLeaseBidPrices(messages: EncodeObject[], userWallet: UserWalletOutput): Promise<void> {
    if (!this.config.get("MANAGED_WALLET_BID_PRICE_GUARD_ENABLED")) return;

    const resolvedBids = await resolveLeaseBids(messages, userWallet.address!, this.bidHttpService);

    for (const { accepted, orderBids } of resolvedBids) {
      this.#assertBidPriceWithinLimits(accepted, orderBids, userWallet);
    }
  }

  #assertBidPriceWithinLimits(accepted: Bid, orderBids: Bid[], userWallet: UserWalletOutput): void {
    const acceptedPrice = Number(accepted.bid.price.amount);
    const denom = accepted.bid.price.denom;

    if (!Number.isFinite(acceptedPrice) || acceptedPrice <= 0) return;

    this.#assertWithinRelativeLimit(acceptedPrice, denom, accepted, orderBids, userWallet);
    this.#assertWithinAbsoluteLimit(acceptedPrice, denom, accepted, userWallet);
  }

  #assertWithinRelativeLimit(acceptedPrice: number, denom: string, accepted: Bid, orderBids: Bid[], userWallet: UserWalletOutput): void {
    const { id } = accepted.bid;

    // Cheapest bid for the same order (gseq + oseq). Needs at least one competing bid to be meaningful.
    const peerPrices = orderBids
      .filter(b => b.bid.id.gseq === id.gseq && b.bid.id.oseq === id.oseq)
      .map(b => Number(b.bid.price.amount))
      .filter(price => Number.isFinite(price) && price > 0);

    if (peerPrices.length < 2) return;

    const normPrice = Math.min(...peerPrices);
    const ratio = acceptedPrice / normPrice;
    const blockMultiplier = this.config.get("MANAGED_WALLET_BID_PRICE_BLOCK_MULTIPLIER");
    const warnMultiplier = this.config.get("MANAGED_WALLET_BID_PRICE_WARN_MULTIPLIER");

    if (ratio >= blockMultiplier) {
      this.#block(
        "relative",
        accepted,
        userWallet,
        { acceptedPrice, normPrice, ratio, denom, blockMultiplier },
        `Bid from provider ${id.provider} is ${ratio.toFixed(1)}x the cheapest competing bid for the same order and was refused for your protection.`
      );
    }

    if (ratio >= warnMultiplier) {
      this.logger.warn({
        event: "LEASE_BID_PRICE_WARNING",
        userId: userWallet.userId,
        owner: id.owner,
        provider: id.provider,
        dseq: id.dseq,
        gseq: id.gseq,
        oseq: id.oseq,
        bseq: id.bseq,
        acceptedPrice,
        normPrice,
        ratio,
        denom,
        warnMultiplier
      });
    }
  }

  #assertWithinAbsoluteLimit(acceptedPrice: number, denom: string, accepted: Bid, userWallet: UserWalletOutput): void {
    const absoluteMax = this.#getAbsoluteMax(denom);
    if (absoluteMax === undefined || acceptedPrice <= absoluteMax) return;

    this.#block(
      "absolute",
      accepted,
      userWallet,
      { acceptedPrice, absoluteMax, denom },
      `Bid from provider ${accepted.bid.id.provider} at ${acceptedPrice} ${denom}/block exceeds the maximum allowed price and was refused for your protection.`
    );
  }

  #block(reason: "relative" | "absolute", accepted: Bid, userWallet: UserWalletOutput, details: Record<string, unknown>, message: string): never {
    const { id } = accepted.bid;
    this.logger.error({
      event: "LEASE_BLOCKED_EXCESSIVE_BID_PRICE",
      reason,
      userId: userWallet.userId,
      owner: id.owner,
      provider: id.provider,
      dseq: id.dseq,
      gseq: id.gseq,
      oseq: id.oseq,
      bseq: id.bseq,
      ...details
    });
    assert(false, 403, message);
  }

  #getAbsoluteMax(denom: string): number | undefined {
    switch (denom) {
      case "uakt":
        return this.config.get("MANAGED_WALLET_BID_PRICE_ABSOLUTE_MAX_UAKT");
      case "uact":
        return this.config.get("MANAGED_WALLET_BID_PRICE_ABSOLUTE_MAX_UACT");
      default:
        return undefined;
    }
  }
}
