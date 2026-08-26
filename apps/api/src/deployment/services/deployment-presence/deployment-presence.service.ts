import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { addMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";

/** Derived from the SDK's own signature rather than a deep import, since it publishes no `CallOptions`. */
type QueryOptions = NonNullable<Parameters<ChainSDK["akash"]["deployment"]["v1beta4"]["getDeployment"]>[1]>;

/** Cosmos' gRPC gateway serves a query at the height named by this request header instead of the latest one. */
const BLOCK_HEIGHT_HEADER = "x-cosmos-block-height";

/**
 * How far past a record's creation the chain must have progressed before an absence is believed.
 *
 * This is not a guess about clock skew: a create is broadcast as an *unordered* cosmos tx carrying
 * `timeoutTimestamp = now + UNORDERED_TX_TTL_MS` (tx-signer, default 30s), so the chain itself refuses to
 * include a create tx more than that long after it was signed, and with the signer's retry ceiling the hard
 * bound on inclusion is around two and a half minutes. Ten minutes is roughly four times a bound the chain
 * enforces, and the remainder absorbs the gap between the database clock that stamped the record and the
 * consensus clock that stamps blocks.
 *
 * That makes this constant load-bearing on `UNORDERED_TX_TTL_MS` in **another service**, silently: raising
 * that TTL past about nine minutes would let a create land later than this margin allows, and nothing here —
 * no test, no type, no log — would notice. Change one and check the other.
 *
 * It is also a floor no configuration can undermine: a grace period shortened below it does not start
 * deleting early, it just makes the compensation retry until the chain has moved far enough on.
 */
const CHAIN_PROGRESS_MARGIN_IN_MIN = 10;

/**
 * The one error a missing deployment produces, and the only one that may be read as an answer rather than a
 * failure to get one. Verified against two independent mainnet REST nodes: an absent deployment returns
 * `HTTP 404 {"code":5,...}`, which the SDK's grpc-gateway transport turns into an `SDKError` carrying
 * `NotFound`. Every other outcome carries a different code — a malformed owner is `InvalidArgument`, a node
 * that does not serve this query version is `Unimplemented`, an unreachable host is `Unknown`, a timeout is
 * `DeadlineExceeded`, and a node asked for a height it does not have is `Unknown` — so none of them can be
 * mistaken for an answer.
 */
function isDeploymentAbsent(error: unknown): boolean {
  return error instanceof SDKError && error.code === SDKErrorCode.NotFound;
}

/**
 * Pins a query to one block height.
 *
 * The transport reads custom request headers off `header`
 * (`requestHeaderWithCompression(..., callOptions?.header, ...)`), while the `CallOptions` it inherits from
 * connectrpc declares only `headers`. Verified against a live endpoint by pinning a height the node cannot
 * have: the singular spelling is refused, the plural one is silently dropped and the query answers at the
 * latest height instead. Spelling this as an intersection rather than the declared field is therefore
 * load-bearing — the typed field would leave the pin off the wire and the guard inert.
 */
function atBlockHeight(height: bigint): QueryOptions {
  const pinned: QueryOptions & { header: Record<string, string> } = { header: { [BLOCK_HEIGHT_HEADER]: height.toString() } };

  return pinned;
}

@singleton()
export class DeploymentPresenceService {
  readonly #chainSdk: ChainSDK;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  /**
   * Whether the chain holds this deployment, in any state. Answers only when the chain answered: any outcome
   * this cannot positively read as "absent" is rethrown, so a caller that deletes on `false` can never delete
   * because a node was unreachable. A response the node served is read as present without inspecting its body,
   * because the cost of the two mistakes is not symmetric — believing a live deployment gone destroys the only
   * copy of its SDL and silently drops its runtime limit, while believing a gone deployment live merely leaves
   * a row nothing reads.
   *
   * `recordedAt` is when the caller wrote down the thing whose existence is in question, and it is what makes
   * a `false` here trustworthy. `REST_API_NODE_URL` is a pooled third-party endpoint on mainnet, so successive
   * queries can be served by different members at different heights and one that is hours behind reports a
   * live deployment absent — truthfully, for its own height. So absence is established in two steps that
   * together leave no room for a stale answer:
   *
   * 1. read the pool's latest block and refuse to proceed unless its timestamp is past `recordedAt` plus a
   *    margin, which establishes that a height exists at which the deployment would already be visible;
   * 2. ask for the deployment **pinned to that height**, so any member that has not reached it must refuse
   *    the query rather than answer from its own shorter chain.
   *
   * Step 2 is what makes this sound rather than merely less likely to be wrong. A lagging member cannot
   * produce `NotFound` for a height above its own — it answers `Unknown` ("cannot query with height in the
   * future"), which is rethrown and retried, most likely onto a different member.
   */
  async isOnChain({ owner, dseq, recordedAt }: { owner: string; dseq: string; recordedAt: Date }): Promise<boolean> {
    const height = await this.#heightPast(recordedAt);

    try {
      await this.#chainSdk.akash.deployment.v1beta4.getDeployment({ id: { owner, dseq: BigInt(dseq) } }, atBlockHeight(height));
      return true;
    } catch (error) {
      if (isDeploymentAbsent(error)) return false;
      throw error;
    }
  }

  async #heightPast(recordedAt: Date): Promise<bigint> {
    const { block } = await this.#chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock();
    const header = block?.header;

    if (!header?.time) {
      throw new Error("Chain did not report a latest block time, so no height can be shown to be past the record");
    }

    const mustBePast = addMinutes(recordedAt, CHAIN_PROGRESS_MARGIN_IN_MIN);

    if (header.time <= mustBePast) {
      throw new Error(
        `Chain has only reached ${header.time.toISOString()}, which is not past ${mustBePast.toISOString()}, so an absent deployment cannot be told from an unindexed one`
      );
    }

    return header.height;
  }
}
