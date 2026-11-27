import { AuthzHttpService, type FeeAllowance } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { addMilliseconds, addMinutes } from "date-fns";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { type FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import {
  type FundingWalletMoveOutput,
  type FundingWalletMovePatch,
  FundingWalletMoveRepository
} from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

/** Clock-skew slack on the time a grant signed before the promotion can still land, which holds only while TX_SIGNER_REQUEST_TIMEOUT_MS stays above tx-signer's SIGN_AND_BROADCAST_DEADLINE_MS. */
const LATE_GRANT_MARGIN_IN_MIN = 1;

/** A run waits on the signer at most three times (revoke, fee allowance, credit), each up to TX_SIGNER_REQUEST_TIMEOUT_MS, so a claim this many timeouts long outlives any run that can still send. */
const CLAIM_LENGTH_IN_SIGNER_TIMEOUTS = 4;

export type FundingWalletMoveOutcome = "moved" | "nothing_to_move" | "needs_review";

type MovedWallet = Pick<UserWalletOutput, "id"> & { address: string };

const FEE_DENOM = "uakt";

type Rotation = { from: FundingWalletOutput; to: FundingWalletOutput };

/** Moves one user's balance from the draining funding wallet to the active one: the old grants are removed first, so the balance never exists on both. */
@singleton()
export class FundingWalletMoveService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly fundingWalletRepository: FundingWalletRepository,
    private readonly fundingWalletMoveRepository: FundingWalletMoveRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly balancesService: BalancesService,
    private readonly authzHttpService: AuthzHttpService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly deploymentAllowanceService: DeploymentAllowanceService,
    private readonly billingConfigService: BillingConfigService,
    private readonly coreConfigService: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FundingWalletMoveService.name });
  }

  /** Safe to run again after any failure: it resumes from the move it saved, and never sends a credit it cannot prove was not sent before. */
  async moveToActive(userWalletId: number): Promise<FundingWalletMoveOutcome> {
    const rotation = await this.#findRotation();
    const wallet = await this.userWalletRepository.findById(userWalletId);

    if (!rotation || !wallet?.address) return "nothing_to_move";

    const movedWallet = { id: wallet.id, address: wallet.address };
    const started = await this.#findOrStart(movedWallet, rotation);
    const move = await this.fundingWalletMoveRepository.claim(started.id, this.#claimSeconds);

    if (!move) throw createError(409, "Another run is moving this user wallet", { userWalletId });

    try {
      return await this.#resume(move, movedWallet, rotation);
    } finally {
      await this.fundingWalletMoveRepository.release(move.id, move.claimedUntil);
    }
  }

  get #claimSeconds(): number {
    return Math.ceil((CLAIM_LENGTH_IN_SIGNER_TIMEOUTS * this.billingConfigService.get("TX_SIGNER_REQUEST_TIMEOUT_MS")) / 1000);
  }

  async #resume(move: FundingWalletMoveOutput, movedWallet: MovedWallet, rotation: Rotation): Promise<FundingWalletMoveOutcome> {
    if (move.status === "revoking") move = await this.#revoke(move, movedWallet, rotation.from);
    if (move.status === "revoked") return await this.#credit(move, movedWallet, rotation);
    if (move.status === "crediting")
      move = await this.#flagForReview(move, "the credit on the new funding wallet was interrupted, so it may or may not be on chain");

    return move.status === "completed" ? "moved" : "needs_review";
  }

  async #findRotation(): Promise<Rotation | undefined> {
    const network = this.coreConfigService.get("NETWORK");
    const [from, to] = await Promise.all([this.fundingWalletRepository.findDraining(network), this.fundingWalletRepository.findActive(network)]);

    if (!from || !to) return undefined;

    const lateGrantsEndAt = this.lateGrantsEndAt(from.drainingSince);

    if (new Date() < lateGrantsEndAt) {
      throw createError(503, "A grant signed before the promotion can still land on the draining funding wallet", { retryAt: lateGrantsEndAt.toISOString() });
    }

    return { from, to };
  }

  /** A grant signed just before the promotion can land on the draining wallet until then, so no move may read a balance earlier. */
  lateGrantsEndAt(drainingSince: Date): Date {
    return addMinutes(addMilliseconds(drainingSince, this.billingConfigService.get("TX_SIGNER_REQUEST_TIMEOUT_MS")), LATE_GRANT_MARGIN_IN_MIN);
  }

  async #findOrStart(wallet: MovedWallet, { from, to }: Rotation): Promise<FundingWalletMoveOutput> {
    const source = { userWalletId: wallet.id, network: from.network, fromFundingWalletId: from.id };
    const started = await this.fundingWalletMoveRepository.findBySource(source);

    if (started) return started;

    const [read, feeAllowance] = await Promise.all([
      this.balancesService.retrieveDeploymentLimitAtLatestHeight(wallet, { granter: from.address }),
      this.authzHttpService.getFeeAllowanceForGranterAndGrantee(from.address, wallet.address)
    ]);

    return await this.fundingWalletMoveRepository.createUnlessStarted({
      ...source,
      toFundingWalletId: to.id,
      status: "revoking",
      readLimit: read.limit,
      readHeight: read.height,
      feeLimit: feeLimitOf(feeAllowance),
      feeExpiresAt: feeAllowance?.allowance.expiration ? new Date(feeAllowance.allowance.expiration) : null
    });
  }

  /** Reads which grants are still there before each attempt, so a retry after a revoke that did land goes on instead of failing on a grant that is gone. */
  async #revoke(move: FundingWalletMoveOutput, wallet: MovedWallet, from: FundingWalletOutput): Promise<FundingWalletMoveOutput> {
    const grant = { granter: from.address, grantee: wallet.address };
    const [hasDepositGrant, hasFeeAllowance] = await Promise.all([
      this.authzHttpService.hasDepositDeploymentGrant(grant.granter, grant.grantee),
      this.authzHttpService.hasFeeAllowance(grant.granter, grant.grantee)
    ]);
    const messages = [
      ...(hasDepositGrant ? [this.rpcMessageService.getRevokeDepositDeploymentGrantMsg(grant)] : []),
      ...(hasFeeAllowance ? [this.rpcMessageService.getRevokeAllowanceMsg(grant)] : [])
    ];

    if (messages.length === 0) return await this.#endRevokeWithNothingLeft(move);

    const sending = await this.#advance(move, { revokeSentAt: new Date() });
    const revokeTxHash = await this.#sendRevoke(sending, messages, move.revokeSentAt);

    return await this.#advance(sending, { status: "revoked", revokeTxHash });
  }

  /** A send that provably revoked nothing puts the record of an earlier send back, so only a revoke that may have landed is ever counted as one. */
  async #sendRevoke(sending: FundingWalletMoveOutput, messages: EncodeObject[], previousRevokeSentAt: Date | null): Promise<string> {
    try {
      const tx = await this.managedSignerService.executeFundingTx(messages);

      if (tx.code !== COSMOS_TX_CODE_OK) throw createError(502, "The chain refused to revoke the grants of the draining funding wallet", { txHash: tx.hash });

      return tx.hash;
    } catch (error) {
      if (!isUnknownTxOutcome(error)) await this.#advance(sending, { revokeSentAt: previousRevokeSentAt });
      else if (error.txHash) await this.#advance(sending, { revokeTxHash: error.txHash });

      throw error;
    }
  }

  /** Grants that were read but are gone without a revoke of ours ended some other way, with no transaction to replay their last changes up to, so their balance is not credited. */
  async #endRevokeWithNothingLeft(move: FundingWalletMoveOutput): Promise<FundingWalletMoveOutput> {
    const hadNothing = move.readLimit === 0 && move.feeLimit === 0;

    if (hadNothing || move.revokeSentAt) return await this.#advance(move, { status: "revoked" });

    return await this.#flagForReview(move, "the grants read on the draining funding wallet were gone before a revoke was sent, so nothing was credited");
  }

  async #credit(move: FundingWalletMoveOutput, wallet: MovedWallet, { from, to }: Rotation): Promise<FundingWalletMoveOutcome> {
    await this.fundingWalletRepository.reassign({ userWalletId: wallet.id, network: to.network, fundingWalletId: to.id });
    await this.#grantFeeAllowance(move, wallet);

    if (move.readLimit === 0) return await this.#complete(move, wallet);

    const credited = await this.#creditBalance(move, wallet);

    if (!credited) return "needs_review";

    if (!credited.revokeTxHash || !credited.revokeSentAt) {
      await this.#flagForReview(
        credited,
        "the balance read before the revoke was credited, but what changed on the old grant between that read and the revoke was not replayed"
      );
      return "needs_review";
    }

    await this.deploymentAllowanceService.watch(wallet, {
      txHash: credited.revokeTxHash,
      readHeight: credited.readHeight,
      readLimit: credited.readLimit,
      sentAt: credited.revokeSentAt.toISOString(),
      granter: from.address
    });

    return await this.#complete(credited, wallet);
  }

  /** Sets the allowance rather than adding to it, so sending it again on a retry changes nothing; one that expired since it was read is left out, as the chain refuses an expiry in the past. */
  async #grantFeeAllowance(move: FundingWalletMoveOutput, wallet: MovedWallet): Promise<void> {
    const hasExpired = !!move.feeExpiresAt && move.feeExpiresAt <= new Date();

    if (move.feeLimit === 0 || hasExpired) return;

    await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
      address: wallet.address,
      derivationIndex: wallet.id,
      limits: { fees: move.feeLimit },
      expiration: move.feeExpiresAt ?? undefined
    });
  }

  /** Marked as crediting before the grant is sent, so a run that dies in between is never mistaken for one that sent nothing. */
  async #creditBalance(move: FundingWalletMoveOutput, wallet: MovedWallet): Promise<FundingWalletMoveOutput | undefined> {
    const crediting = await this.#advance(move, { status: "crediting" });

    try {
      await this.deploymentAllowanceService.adjust(wallet, crediting.readLimit, { redo: true });
      return crediting;
    } catch (error) {
      if (!isUnknownTxOutcome(error)) {
        await this.#advance(crediting, { status: "revoked" });
        throw error;
      }

      if (error.txHash) return crediting;

      await this.#flagForReview(crediting, "the signer could not tell whether the credit on the new funding wallet was sent");
      return undefined;
    }
  }

  /** Refuses a change to a move another run has moved on since this run last saw it, so a step is never undone or taken twice. */
  async #advance(move: FundingWalletMoveOutput, patch: FundingWalletMovePatch): Promise<FundingWalletMoveOutput> {
    const advanced = await this.fundingWalletMoveRepository.updateFrom(move.id, move.status, patch);

    if (!advanced) throw createError(409, "Another run changed this move", { moveId: move.id, expectedStatus: move.status });

    return advanced;
  }

  async #complete(move: FundingWalletMoveOutput, wallet: MovedWallet): Promise<FundingWalletMoveOutcome> {
    await this.#advance(move, { status: "completed" });
    this.#logger.info({ event: "FUNDING_WALLET_MOVE_COMPLETED", userWalletId: wallet.id, moveId: move.id, readLimit: move.readLimit });

    return "moved";
  }

  async #flagForReview(move: FundingWalletMoveOutput, failure: string): Promise<FundingWalletMoveOutput> {
    this.#logger.error({ event: "FUNDING_WALLET_MOVE_NEEDS_REVIEW", userWalletId: move.userWalletId, moveId: move.id, readLimit: move.readLimit, failure });

    return await this.#advance(move, { status: "failed", failure });
  }
}

function feeLimitOf(feeAllowance: FeeAllowance | undefined): number {
  const limit = feeAllowance?.allowance.spend_limit.find(({ denom }) => denom === FEE_DENOM);

  return limit ? parseInt(limit.amount, 10) : 0;
}
