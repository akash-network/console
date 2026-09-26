import { type Meter, metrics } from "@opentelemetry/api";
import { singleton } from "tsyringe";

export interface SyncLag {
  committedHeight: number;
  lagBlocks: number | undefined;
  lagSeconds: number;
}

/** The lag in seconds is measured from the last committed block's own time, so a stalled sync keeps reporting a growing lag rather than its last value. */
@singleton()
export class SyncLagMetrics {
  #tipHeight: number | undefined;
  #committed: { height: number; datetime: Date } | undefined;

  constructor() {
    registerSyncLagGauges(metrics.getMeter("chain-indexer-sync"), () => this.read());
  }

  recordTip(height: number): void {
    this.#tipHeight = height;
  }

  recordCommitted(height: number, datetime: Date): void {
    this.#committed = { height, datetime };
  }

  read(now = new Date()): SyncLag | undefined {
    if (!this.#committed) {
      return undefined;
    }
    return {
      committedHeight: this.#committed.height,
      lagBlocks: this.#tipHeight === undefined ? undefined : Math.max(0, this.#tipHeight - this.#committed.height),
      lagSeconds: Math.max(0, (now.getTime() - this.#committed.datetime.getTime()) / 1_000)
    };
  }
}

export function registerSyncLagGauges(meter: Meter, read: () => SyncLag | undefined): void {
  meter.createObservableGauge("indexer_sync_height", { description: "Height of the last block live sync committed" }).addCallback(result => {
    const lag = read();
    if (lag) result.observe(lag.committedHeight);
  });
  meter.createObservableGauge("indexer_sync_lag_blocks", { description: "Blocks between the chain tip and the last committed block" }).addCallback(result => {
    const lag = read();
    if (lag?.lagBlocks !== undefined) result.observe(lag.lagBlocks);
  });
  meter
    .createObservableGauge("indexer_sync_lag_seconds", { description: "Seconds since the time of the last committed block", unit: "s" })
    .addCallback(result => {
      const lag = read();
      if (lag) result.observe(lag.lagSeconds);
    });
}
