import { addressTransactionsRouter } from "@src/routes/address-transactions/address-transactions.router";
import { blocksRouter } from "@src/routes/blocks/blocks.router";
import { healthzRouter } from "@src/routes/healthz/healthz.router";
import { networkStatsRouter } from "@src/routes/network-stats/network-stats.router";
import { statusRouter } from "@src/routes/status/status.router";

export { addressTransactionsRouter, blocksRouter, healthzRouter, networkStatsRouter, statusRouter };

/** Every handler the app mounts, in mount order; the OpenAPI document is generated from the same list. */
export const apiHandlers = [healthzRouter, statusRouter, blocksRouter, addressTransactionsRouter, networkStatsRouter];
