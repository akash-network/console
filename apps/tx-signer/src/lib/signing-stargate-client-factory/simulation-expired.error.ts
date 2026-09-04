/**
 * A simulation body is stamped for the attempt that sends it, so an expiry here cannot mean a stale replay: it means
 * the node's clock runs ahead of the signer's, or the TTL is shorter than one RPC round trip.
 */
export class SimulationExpiredError extends Error {
  readonly name = "SimulationExpiredError";

  constructor(ttlMs: number, cause: unknown) {
    super(`Gas simulation was rejected as expired even though its ${ttlMs}ms window opened for this attempt`, { cause });
  }
}
