import { TxBody, TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { encodeSecp256k1Pubkey } from "@cosmjs/amino";
import { fromBase64 } from "@cosmjs/encoding";
import type { EncodeObject, OfflineSigner, Registry } from "@cosmjs/proto-signing";
import type { OfflineDirectSigner } from "@cosmjs/proto-signing";
import { encodePubkey, isOfflineDirectSigner, makeAuthInfoBytes, makeSignDoc } from "@cosmjs/proto-signing";
import type { SigningStargateClientOptions } from "@cosmjs/stargate";
import { calculateFee, createProtobufRpcClient, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import type { CometClient, RpcClient } from "@cosmjs/tendermint-rpc";
import { Comet38Client, HttpClient } from "@cosmjs/tendermint-rpc";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { ServiceClientImpl, SimulateRequest } from "cosmjs-types/cosmos/tx/v1beta1/service";
import { randomUUID } from "node:crypto";

import type { Wallet } from "@src/lib/wallet/wallet";
import { memoizeAsync } from "../../caching/helpers/helpers";
import { RetryingRpcClient } from "../retrying-rpc-client/retrying-rpc-client";

const MEMO = "akash console";
const FEES_DENOM = "uakt";

export interface UnorderedTxSignConfig {
  /** Added to `Date.now()` to derive the tx `timeoutTimestamp` (the unordered-tx TTL). */
  ttlMs: number;
  /** Multiplier applied to the simulated gas to derive `gasWanted`. */
  gasMultiplier: number;
  /** Average gas price in {@link FEES_DENOM}, e.g. `0.025`. */
  averageGasPrice: number;
}

type SimulatingSigningStargateClientOptions = SigningStargateClientOptions & { signConfig: UnorderedTxSignConfig };

export class SigningStargateWithUnorderedSupportClient extends SigningStargateClient {
  #queryClientService?: ServiceClientImpl;

  readonly #signer: OfflineDirectSigner;

  readonly #signConfig: UnorderedTxSignConfig;

  readonly #getChainId = memoizeAsync(() => this.getChainId());

  readonly #getFirstAccount = memoizeAsync(async () => (await this.#signer.getAccounts())[0]);

  readonly #getAddress = memoizeAsync(async () => (await this.#getFirstAccount()).address);

  readonly #getPubkey = memoizeAsync(async () => encodePubkey(encodeSecp256k1Pubkey((await this.#getFirstAccount()).pubkey)));

  readonly #getAccountNumber = memoizeAsync(async () => {
    const account = await this.getAccount(await this.#getAddress());

    if (!account) {
      throw new Error("Failed to get account info");
    }

    return account.accountNumber;
  });

  static createWithSigner(
    cometClient: CometClient,
    signer: OfflineSigner,
    options: SimulatingSigningStargateClientOptions
  ): SigningStargateWithUnorderedSupportClient {
    return new SigningStargateWithUnorderedSupportClient(cometClient, signer, options);
  }

  protected constructor(cometClient: CometClient | undefined, signer: OfflineSigner, options: SimulatingSigningStargateClientOptions) {
    super(cometClient, signer, options);

    if (!isOfflineDirectSigner(signer)) {
      throw new Error("SimulatingSigningStargateClient requires a direct signer");
    }

    this.#signer = signer;
    this.#signConfig = options.signConfig;
  }

  /**
   * Signs Akash transactions as {@link https://docs.cosmos.network/sdk/latest/reference/architecture/adr-070-unordered-account | unordered}
   * cosmos-sdk transactions: every tx sets `unordered: true`, a `timeoutTimestamp` TTL, and a zero sequence. The chain deduplicates by
   * tx hash within the TTL window instead of by account sequence, so transactions no longer need to be serialized or numbered — they can
   * be signed and broadcast fully concurrently, which removes the account-sequence-mismatch failure mode entirely.
   *
   * Gas is estimated with {@link #simulateRawTx} rather than the inherited `simulate(signerAddress, messages, memo)`. cosmjs's `simulate`
   * rebuilds its own tx body from just the messages and memo — it never sets `unordered`/`timeoutTimestamp` — so it undercounts gas: an
   * unordered tx makes the ante handler write an entry to the unordered-nonce store to dedupe replays, and that extra store write is not
   * exercised when simulating an ordered body. The real tx then consumes more gas than estimated and lands with `code: 11` ("out of gas
   * in location: WriteFlat"). Simulating the exact body we broadcast makes the estimate account for that write.
   *
   * When `options.gas` is provided the simulation step is skipped and the value is used verbatim as the gas limit. This is the
   * gas-recovery path: some messages (e.g. an escrow deposit that settles accrued rent) consume gas that grows with the block height
   * they land in, so simulation structurally under-counts them. After such a tx lands out of gas the caller re-signs with a gas limit
   * derived from the actual on-chain `gasUsed` — a far more reliable figure than re-simulating, which just repeats the under-count.
   */
  async signUnordered(messages: readonly EncodeObject[], options?: { granter?: string; gas?: number }): Promise<TxRaw> {
    const [address, chainId, accountNumber, pubkey] = await Promise.all([this.#getAddress(), this.#getChainId(), this.#getAccountNumber(), this.#getPubkey()]);

    const txBody = this.#buildTxBody(messages);
    const fee = await this.#estimateFee(TxBody.encode(txBody).finish(), pubkey, { granter: options?.granter, gas: options?.gas });

    // sequence MUST be 0 for unordered transactions; the chain rejects a non-zero sequence when unordered is set.
    const authInfoBytes = makeAuthInfoBytes([{ pubkey, sequence: 0 }], fee.amount, Number(fee.gas), fee.granter, fee.payer);
    // update timestampTimeout to compensate time spent in doing stuff above
    txBody.timeoutTimestamp = new Date(Date.now() + this.#signConfig.ttlMs);
    const bodyBytes = TxBody.encode(txBody).finish();
    const signDoc = makeSignDoc(bodyBytes, authInfoBytes, chainId, accountNumber);
    const { signature, signed } = await this.#signer.signDirect(address, signDoc);

    return TxRaw.fromPartial({
      bodyBytes: signed.bodyBytes,
      authInfoBytes: signed.authInfoBytes,
      signatures: [fromBase64(signature.signature)]
    });
  }

  async #simulateRawTx(txBytes: Uint8Array): Promise<number> {
    this.#queryClientService ??= new ServiceClientImpl(createProtobufRpcClient(this.forceGetQueryClient()));
    const { gasInfo } = await this.#queryClientService.Simulate(SimulateRequest.fromPartial({ txBytes }));

    if (!gasInfo) {
      throw new Error("Failed to simulate transaction: no gas info returned");
    }

    return Number(gasInfo.gasUsed);
  }

  #buildTxBody(messages: readonly EncodeObject[]) {
    return TxBody.fromPartial({
      messages: messages.map(message => this.registry.encodeAsAny(message)),
      memo: MEMO,
      unordered: true,
      timeoutTimestamp: new Date(Date.now() + this.#signConfig.ttlMs)
    });
  }

  async #estimateFee(bodyBytes: Uint8Array, pubkey: ReturnType<typeof encodePubkey>, options: { granter?: string; gas?: number }) {
    const gas = options.gas ?? (await this.#estimateGas(bodyBytes, pubkey));
    const fee = calculateFee(gas, GasPrice.fromString(`${this.#signConfig.averageGasPrice}${FEES_DENOM}`));

    return options.granter ? { ...fee, granter: options.granter } : fee;
  }

  async #estimateGas(bodyBytes: Uint8Array, pubkey: ReturnType<typeof encodePubkey>): Promise<number> {
    // Empty fee with an unset sign mode: this keeps the node treating the tx as a gas simulation rather than one to
    // execute (it skips signature verification when simulating). Sequence stays 0 to match the unordered tx we sign.
    const authInfoBytes = makeAuthInfoBytes([{ pubkey, sequence: 0 }], [], 0, undefined, undefined, SignMode.SIGN_MODE_UNSPECIFIED);
    const txBytes = TxRaw.encode(TxRaw.fromPartial({ bodyBytes, authInfoBytes, signatures: [new Uint8Array()] })).finish();

    const gasEstimation = await this.#simulateRawTx(txBytes);
    return Math.ceil(gasEstimation * this.#signConfig.gasMultiplier);
  }
}

export type CreateSigningStargateClient = (
  endpoint: string,
  wallet: Wallet,
  options: { registry?: Registry; signConfig: UnorderedTxSignConfig }
) => SigningStargateWithUnorderedSupportClient;

export const createSigningStargateClientFactory =
  (
    createRpcClient: (endpoint: string) => RpcClient,
    ProvidedComet38Client: typeof Comet38Client,
    factory: typeof SigningStargateWithUnorderedSupportClient.createWithSigner
  ): CreateSigningStargateClient =>
  (endpoint, signer, options): SigningStargateWithUnorderedSupportClient => {
    const rpcClient = createRpcClient(endpoint);
    const cometClient = ProvidedComet38Client.create(rpcClient);
    return factory(cometClient, signer, options);
  };

export const createSigningStargateClient: CreateSigningStargateClient = createSigningStargateClientFactory(
  (endpoint: string) =>
    new RetryingRpcClient(
      new HttpClient({
        url: endpoint,
        headers: {
          "X-Proxy-Key": randomUUID()
        }
      })
    ),
  Comet38Client,
  SigningStargateWithUnorderedSupportClient.createWithSigner
);
