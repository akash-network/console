import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { withSpan } from "@akashnetwork/instrumentation";
import type { LoggerService } from "@akashnetwork/logging";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import type { RetryPolicy } from "cockatiel";
import { ConstantBackoff, handleWhenResult, retry } from "cockatiel";

import type { AppConfigService } from "@src/services/app-config/app-config.service";
import type { SigningStargateWithUnorderedSupportClient } from "../signing-stargate-client-factory/signing-stargate-client.factory";

export interface SignAndBroadcastOptions {
  fee?: {
    granter: string;
  };
}

/** Interval between tx-recovery polls. Kept below Akash's ~6s block time so several polls land within each block window. */
const TX_RECOVERY_POLL_INTERVAL_MS = 2_000;

/**
 * How far past the tx TTL to keep polling. `getTx` runs a `tx_search`, which only returns a tx once it is committed AND
 * written to the node's tx index, and that index lags block commit — so we poll a bit beyond the TTL to still catch a tx
 * that landed right at the deadline.
 */
const TX_RECOVERY_WINDOW_FACTOR = 1.2;

/**
 * How many times a tx that lands out of gas is re-signed with a higher gas limit and rebroadcast. Gas for some messages
 * (e.g. an escrow deposit settling accrued rent) grows with the block height they land in, so simulation structurally
 * under-counts and the first attempt can land short. Each retry learns the actual on-chain `gasUsed`, so the limit climbs
 * monotonically and converges within a couple of attempts.
 */
const OUT_OF_GAS_RETRY_LIMIT = 3;

/** Cosmos SDK `ErrOutOfGas` code (root `sdk` codespace). */
const OUT_OF_GAS_CODE = 11;

export class SigningClientService {
  readonly #client: SigningStargateWithUnorderedSupportClient;

  readonly #txRecoveryExecutor: RetryPolicy;

  readonly #gasRecoveryMultiplier: number;

  readonly #logger: LoggerService;

  constructor(client: SigningStargateWithUnorderedSupportClient, config: AppConfigService, loggerContext = SigningClientService.name) {
    this.#client = client;
    this.#txRecoveryExecutor = retry(
      handleWhenResult(res => !res),
      {
        maxAttempts: Math.ceil((config.get("UNORDERED_TX_TTL_MS") * TX_RECOVERY_WINDOW_FACTOR) / TX_RECOVERY_POLL_INTERVAL_MS),
        backoff: new ConstantBackoff(TX_RECOVERY_POLL_INTERVAL_MS)
      }
    );
    this.#gasRecoveryMultiplier = config.get("GAS_RECOVERY_MULTIPLIER");
    this.#logger = createOtelLogger({ context: loggerContext });
  }

  async signAndBroadcast(messages: readonly EncodeObject[], options?: SignAndBroadcastOptions): Promise<IndexedTx> {
    this.#logger.debug({
      event: "SIGN_AND_BROADCAST_BEGIN",
      messageTypes: messages.map(m => m.typeUrl),
      granter: options?.fee?.granter
    });

    try {
      let gas: number | undefined;

      for (let attempt = 0; ; attempt++) {
        const txHash = await withSpan("SigningClientService.signAndBroadcast", async () => {
          const signedTx = await this.#client.signUnordered(messages, { granter: options?.fee?.granter, gas });
          return await this.#broadcast(signedTx);
        });

        const tx = await this.#tryRecoverTransaction(txHash);

        if (!tx) {
          const error = new Error("Failed to sign and broadcast transaction");
          this.#logger.error({ event: "SIGN_AND_BROADCAST_TX_NOT_FOUND", txHash, error });
          throw error;
        }

        if (this.#isOutOfGas(tx) && attempt < OUT_OF_GAS_RETRY_LIMIT) {
          const nextGasLimit = this.#nextGasLimit(tx);

          if (nextGasLimit !== undefined) {
            gas = nextGasLimit;
            this.#logger.warn({
              event: "SIGN_AND_BROADCAST_OUT_OF_GAS_RETRY",
              txHash,
              attempt: attempt + 1,
              gasWanted: Number(tx.gasWanted),
              gasUsed: Number(tx.gasUsed),
              nextGasLimit
            });
            continue;
          }

          // We can't derive a usable gas limit (e.g. a missing/misconfigured margin) — don't crash the sign flow, just
          // return the out-of-gas tx as the terminal result, matching the behavior before gas recovery existed.
          this.#logger.error({
            event: "SIGN_AND_BROADCAST_OUT_OF_GAS_UNRECOVERABLE",
            txHash,
            gasWanted: Number(tx.gasWanted),
            gasUsed: Number(tx.gasUsed)
          });
        }

        this.#logger.debug({ event: "SIGN_AND_BROADCAST_SUCCESS", txHash, height: tx.height, code: tx.code });

        return tx;
      }
    } catch (error) {
      this.#logger.debug({ event: "SIGN_AND_BROADCAST_ERROR", error });
      throw error;
    }
  }

  #isOutOfGas(tx: IndexedTx): boolean {
    // Corroborate the code with the physical signature of an out-of-gas abort — execution consumed at least the whole
    // gas limit — so a code 11 from a non-root codespace can't false-positive a retry.
    return tx.code === OUT_OF_GAS_CODE && tx.gasUsed >= tx.gasWanted;
  }

  #nextGasLimit(tx: IndexedTx): number | undefined {
    // `gasUsed` is where execution aborted, so the true requirement is at least this — the multiplier covers that plus the
    // extra settlement gas that accrues between this failed attempt and the retry's (later) inclusion height. Guard the
    // result: a non-integer (e.g. NaN from a missing multiplier) must never reach cosmjs `calculateFee`, which throws on one.
    const nextGasLimit = Math.ceil(Number(tx.gasUsed) * this.#gasRecoveryMultiplier);
    return Number.isSafeInteger(nextGasLimit) && nextGasLimit > 0 ? nextGasLimit : undefined;
  }

  async #broadcast(signedTx: TxRaw): Promise<string> {
    const txBytes = TxRaw.encode(signedTx).finish();

    try {
      return await this.#client.broadcastTxSync(txBytes);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.toLowerCase().includes("tx already exists in cache")) {
        return toHex(sha256(txBytes));
      }

      throw error;
    }
  }

  async #tryRecoverTransaction(hash: string): Promise<IndexedTx | null> {
    return await this.#txRecoveryExecutor.execute(context => {
      this.#logger.debug({ event: "TX_RECOVERY_ATTEMPT", txHash: hash, attempt: context.attempt });
      return this.#client.getTx(hash);
    });
  }
}
