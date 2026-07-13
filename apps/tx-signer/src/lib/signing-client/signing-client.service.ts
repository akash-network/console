import { TxBody, TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { withSpan } from "@akashnetwork/instrumentation";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { encodeSecp256k1Pubkey } from "@cosmjs/amino";
import { sha256 } from "@cosmjs/crypto";
import { fromBase64, toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { encodePubkey, makeAuthInfoBytes, makeSignDoc } from "@cosmjs/proto-signing";
import type { IndexedTx, SigningStargateClient } from "@cosmjs/stargate";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import { ExponentialBackoff, handleWhenResult, retry } from "cockatiel";

import type { AppConfigService } from "@src/services/app-config/app-config.service";
import { memoizeAsync } from "../../caching/helpers/helpers";
import type { CreateSigningStargateClient } from "../signing-stargate-client-factory/signing-stargate-client.factory";
import type { Wallet } from "../wallet/wallet";

export interface SignAndBroadcastOptions {
  fee?: {
    granter: string;
  };
}

/**
 * Signs and broadcasts Akash transactions as {@link https://docs.cosmos.network/sdk/latest/reference/architecture/adr-070-unordered-account | unordered}
 * cosmos-sdk transactions: every tx sets `unordered: true`, a `timeoutTimestamp` TTL, and a zero sequence. The chain deduplicates by
 * tx hash within the TTL window instead of by account sequence, so transactions no longer need to be serialized or numbered — they can
 * be signed and broadcast fully concurrently, which removes the account-sequence-mismatch failure mode entirely.
 */
export class SigningClientService {
  readonly #MEMO = "akash console";

  readonly #FEES_DENOM = "uakt";

  #client: SigningStargateClient;

  #inFlightCount = 0;

  readonly #txRecoveryExecutor = retry(
    handleWhenResult(res => !res),
    {
      maxAttempts: 5,
      backoff: new ExponentialBackoff({ maxDelay: 10_000, initialDelay: 1_000 })
    }
  );

  readonly #getChainId = memoizeAsync(() => this.#client.getChainId());

  readonly #getAddress = memoizeAsync(() => this.wallet.getFirstAddress());

  readonly #getAccountNumber = memoizeAsync(async () => {
    const account = await this.#client.getAccount(await this.#getAddress());

    if (!account) {
      throw new Error("Failed to get account info");
    }

    return account.accountNumber;
  });

  readonly #getPubkey = memoizeAsync(async () => {
    const [account] = await this.wallet.getAccounts();
    return encodePubkey(encodeSecp256k1Pubkey(account.pubkey));
  });

  readonly #logger = createOtelLogger({ context: this.loggerContext });

  get hasPendingTransactions() {
    return this.#inFlightCount > 0;
  }

  constructor(
    private readonly config: AppConfigService,
    private readonly wallet: Wallet,
    private readonly registry: Registry,
    createClientWithSigner: CreateSigningStargateClient,
    private readonly loggerContext = SigningClientService.name
  ) {
    this.#client = createClientWithSigner(this.config.get("RPC_NODE_ENDPOINT"), this.wallet, {
      registry: this.registry
    });
  }

  async signAndBroadcast(messages: readonly EncodeObject[], options?: SignAndBroadcastOptions): Promise<IndexedTx> {
    this.#inFlightCount++;
    this.#logger.debug({
      event: "SIGN_AND_BROADCAST_BEGIN",
      messageTypes: messages.map(m => m.typeUrl),
      granter: options?.fee?.granter
    });

    try {
      const txHash = await withSpan("SigningClientService.signAndBroadcast", async () => {
        const signedTx = await this.#signUnordered(messages, options);
        return await this.#broadcast(signedTx);
      });

      const tx = await this.#tryRecoverTransaction(txHash);

      if (!tx) {
        const error = new Error("Failed to sign and broadcast transaction");
        this.#logger.error({ event: "SIGN_AND_BROADCAST_TX_NOT_FOUND", txHash, error });
        throw error;
      }

      this.#logger.debug({ event: "SIGN_AND_BROADCAST_SUCCESS", txHash, height: tx.height });

      return tx;
    } catch (error) {
      this.#logger.debug({ event: "SIGN_AND_BROADCAST_ERROR", error });
      throw error;
    } finally {
      this.#inFlightCount--;
    }
  }

  async #signUnordered(messages: readonly EncodeObject[], options?: SignAndBroadcastOptions): Promise<TxRaw> {
    const [address, chainId, accountNumber, pubkey] = await Promise.all([this.#getAddress(), this.#getChainId(), this.#getAccountNumber(), this.#getPubkey()]);

    const fee = await this.#estimateFee(messages, this.#FEES_DENOM, options?.fee?.granter);

    const bodyBytes = TxBody.encode(
      TxBody.fromPartial({
        messages: messages.map(message => this.registry.encodeAsAny(message)),
        memo: this.#MEMO,
        unordered: true,
        timeoutTimestamp: new Date(Date.now() + this.config.get("UNORDERED_TX_TTL_MS"))
      })
    ).finish();

    // sequence MUST be 0 for unordered transactions; the chain rejects a non-zero sequence when unordered is set.
    const authInfoBytes = makeAuthInfoBytes([{ pubkey, sequence: 0 }], fee.amount, Number(fee.gas), fee.granter, fee.payer);
    const signDoc = makeSignDoc(bodyBytes, authInfoBytes, chainId, accountNumber);
    const { signature, signed } = await this.wallet.signDirect(address, signDoc);

    return TxRaw.fromPartial({
      bodyBytes: signed.bodyBytes,
      authInfoBytes: signed.authInfoBytes,
      signatures: [fromBase64(signature.signature)]
    });
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

  async #estimateFee(messages: readonly EncodeObject[], denom: string, granter?: string) {
    const gasEstimation = await this.#client.simulate(await this.#getAddress(), messages, this.#MEMO);
    const estimatedGas = Math.ceil(gasEstimation * this.config.get("GAS_SAFETY_MULTIPLIER"));

    const fee = calculateFee(estimatedGas, GasPrice.fromString(`${this.config.get("AVERAGE_GAS_PRICE")}${denom}`));

    return granter ? { ...fee, granter } : fee;
  }
}
