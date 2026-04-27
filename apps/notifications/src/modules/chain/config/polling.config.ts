export interface PollingConfig {
  maxDelay: number;
  startingDelay: number;
  timeMultiple: number;
  numOfAttempts: number;
}

export const pollingConfig: PollingConfig = {
  maxDelay: 5_000,
  startingDelay: 500,
  timeMultiple: 2,
  numOfAttempts: 5
};
