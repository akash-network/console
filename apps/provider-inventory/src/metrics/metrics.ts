import { metrics } from "@akashnetwork/instrumentation";

const meter = metrics.getMeter("provider-inventory", "1.0.0");

export type ProviderState = "total" | "monitored" | "dead" | "online";
export type StreamMessageResult = "noop" | "updated" | "error";

export const providersGauge = meter.createGauge<{ state: ProviderState }>("provider_inventory_providers", {
  description:
    "Number of providers by state. total/dead are sampled per discovery tick; online/monitored is updated in real time as streams connect and disconnect"
});

export const providerInventoryStreamUpdates = meter.createCounter<{ provider: string; result: StreamMessageResult }>(
  "provider_inventory_stream_messages_total",
  {
    description: "Post-throttle provider inventory stream updates by processing result"
  }
);

const CANDIDATE_COUNT_BUCKETS = [0, 1, 2, 5, 10, 25, 50, 75, 100, 250, 500];

export const bidScreeningPrefilterCandidates = meter.createHistogram("bid_screening_prefilter_candidates", {
  description: "Candidate providers returned by the DB prefilter per bid screening request",
  unit: "{candidate}",
  advice: { explicitBucketBoundaries: CANDIDATE_COUNT_BUCKETS }
});

export const bidScreeningBinPackerMatched = meter.createHistogram("bid_screening_bin_packer_matched", {
  description: "Candidate providers matched by the bin packer per bid screening request",
  unit: "{candidate}",
  advice: { explicitBucketBoundaries: CANDIDATE_COUNT_BUCKETS }
});
