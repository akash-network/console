import type { BackoffOptions } from 'exponential-backoff';

export const pollingConfig: BackoffOptions = {
  maxDelay: 5_000,
  startingDelay: 500,
  timeMultiple: 2,
  numOfAttempts: 5,
  jitter: 'none',
};
