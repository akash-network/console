import { tracing } from "@opentelemetry/sdk-node";

/** Records every request, even one whose caller chose not to sample its own trace, because span metrics are derived from these spans. */
export const requestSampler = new tracing.ParentBasedSampler({
  root: new tracing.AlwaysOnSampler(),
  remoteParentNotSampled: new tracing.AlwaysOnSampler()
});
