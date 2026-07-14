/**
 * How much of the configuration is locked (absent = nothing locked, still configuring):
 * - `"onchain"`: the deployment exists on-chain, so the cards baked into it (resources, placement, ports, logs, …) are
 *   locked; the manifest-only cards (image, env vars, commands) stay editable and get pushed as an update before the lease.
 * - `"all"`: a create / close / deploy operation is in flight, so every card is locked.
 *
 * A structural card is locked whenever there's any lock (`!!lock`); a manifest card is locked only under `"all"`.
 */
export type ConfigurationLock = "onchain" | "all";
