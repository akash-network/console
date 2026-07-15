import { TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { withSpan } from "@akashnetwork/instrumentation";
import type { LoggerService } from "@akashnetwork/logging";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { BroadcastTxError, type IndexedTx } from "@cosmjs/stargate";
import type { RetryPolicy } from "cockatiel";
import { ConstantBackoff, handleWhenResult, Policy, retry } from "cockatiel";

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

  readonly #txPoller: RetryPolicy;
  readonly #signAndBroadcastExecutor: RetryPolicy;

  readonly #gasRecoveryMultiplier: number;

  readonly #logger: LoggerService;

  constructor(client: SigningStargateWithUnorderedSupportClient, config: AppConfigService, loggerContext = SigningClientService.name) {
    this.#client = client;
    this.#txPoller = retry(
      handleWhenResult(res => !res),
      {
        maxAttempts: Math.ceil((config.get("UNORDERED_TX_TTL_MS") * TX_RECOVERY_WINDOW_FACTOR) / TX_RECOVERY_POLL_INTERVAL_MS),
        backoff: new ConstantBackoff(TX_RECOVERY_POLL_INTERVAL_MS)
      }
    );
    this.#gasRecoveryMultiplier = config.get("GAS_RECOVERY_MULTIPLIER");
    this.#signAndBroadcastExecutor = retry(
      new Policy({
        errorFilter: error => this.#canRecoverFromOutOfGas(error),
        resultFilter: result => this.#canRecoverFromOutOfGas(result)
      }),
      {
        maxAttempts: OUT_OF_GAS_RETRY_LIMIT,
        backoff: new ConstantBackoff(0)
      }
    );
    this.#logger = createOtelLogger({ context: loggerContext });
  }

  async signAndBroadcast(messages: readonly EncodeObject[], options?: SignAndBroadcastOptions): Promise<IndexedTx> {
    this.#logger.debug({
      event: "SIGN_AND_BROADCAST_BEGIN",
      messageTypes: messages.map(m => m.typeUrl),
      granter: options?.fee?.granter
    });

    try {
      let prevResult: unknown;
      const tx = await this.#signAndBroadcastExecutor.execute(async context => {
        const prevOutOfGasContext = this.#getOutOfGasContext(prevResult);
        let gas: number | undefined;

        if (prevOutOfGasContext) {
          gas = this.#nextGasLimit(prevOutOfGasContext.gasUsed);
          this.#logger.warn({
            event: "SIGN_AND_BROADCAST_OUT_OF_GAS_RETRY",
            attempt: context.attempt,
            gasUsedInTx: prevOutOfGasContext.gasWanted,
            gasRequired: prevOutOfGasContext.gasUsed,
            nextGasLimit: gas
          });
        }

        try {
          const txHash = await withSpan("SigningClientService.signAndBroadcast", async () => {
            const signedTx = await this.#client.signUnordered(messages, { granter: options?.fee?.granter, gas });
            return await this.#broadcast(signedTx);
          });

          const foundTx = await this.#pollTx(txHash);

          if (!foundTx) {
            this.#logger.error({ event: "SIGN_AND_BROADCAST_TX_NOT_FOUND", txHash });
            throw new Error("Sign and broadcast succeeded but the transaction could not be found on-chain");
          }

          prevResult = foundTx;
          return foundTx;
        } catch (error) {
          prevResult = error;
          throw error;
        }
      });

      this.#logger.debug({ event: "SIGN_AND_BROADCAST_SUCCESS", txHash: tx.hash, height: tx.height, code: tx.code });

      return tx;
    } catch (error) {
      this.#logger.debug({ event: "SIGN_AND_BROADCAST_ERROR", error });
      throw error;
    }
  }

  /**
   * Recognizes an out-of-gas outcome from either surface it can appear on and returns the on-chain gas figures, or
   * undefined when it isn't out of gas. A tx can run out of gas at CheckTx — `broadcastTxSync` rejects with a
   * {@link BroadcastTxError} whose log carries the gas — or at DeliverTx — the committed {@link IndexedTx} exposes
   * `gasUsed`/`gasWanted` directly. In both cases, corroborate the code with the physical signature of the abort (an
   * out-of-gas marker in the log and execution having consumed at least the whole limit) so a code 11 from a non-root
   * codespace can't false-positive a retry.
   */
  #getOutOfGasContext(outcome: unknown): OutOfGasInfo | undefined {
    if (outcome instanceof BroadcastTxError) {
      return outcome.code === OUT_OF_GAS_CODE ? parseOutOfGasLog(outcome.log) : undefined;
    }

    if (isIndexedTx(outcome) && outcome.code === OUT_OF_GAS_CODE && outcome.gasUsed >= outcome.gasWanted) {
      return { gasWanted: Number(outcome.gasWanted), gasUsed: Number(outcome.gasUsed) };
    }

    return undefined;
  }

  #canRecoverFromOutOfGas(outcome: unknown): boolean {
    return this.#getOutOfGasContext(outcome) !== undefined;
  }

  #nextGasLimit(gasUsed: number): number {
    return Math.ceil(gasUsed * this.#gasRecoveryMultiplier);
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

  async #pollTx(hash: string): Promise<IndexedTx | null> {
    return await this.#txPoller.execute(context => {
      this.#logger.debug({ event: "TX_POLL_ATTEMPT", txHash: hash, attempt: context.attempt });
      return this.#client.getTx(hash);
    });
  }
}

interface OutOfGasInfo {
  gasWanted: number;
  gasUsed: number;
}

function isIndexedTx(value: unknown): value is IndexedTx {
  return typeof value === "object" && value !== null && "gasUsed" in value && typeof (value as { gasUsed: unknown }).gasUsed === "bigint";
}

/** Explicit `ErrOutOfGas` marker the SDK writes into the abort log, used to corroborate the code before trusting the figures. */
const OUT_OF_GAS_LOG_MARKER = /out\s+of\s+gas/i;
const OUT_OF_GAS_LOG_PATTERN = /gasWanted:\s*(\d+),\s*gasUsed:\s*(\d+)/;
function parseOutOfGasLog(log: string | undefined): OutOfGasInfo | undefined {
  if (!log || !OUT_OF_GAS_LOG_MARKER.test(log)) {
    return undefined;
  }

  const match = OUT_OF_GAS_LOG_PATTERN.exec(log);
  if (!match) {
    return undefined;
  }

  const gasWanted = Number(match[1]);
  const gasUsed = Number(match[2]);

  // Only a genuine out-of-gas abort consumes at least the whole limit; anything short is a code 11 from another codespace.
  return gasUsed >= gasWanted ? { gasWanted, gasUsed } : undefined;
}
