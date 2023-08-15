export type ProviderStatsKey = "count" | "cpu" | "gpu" | "memory" | "storage";

export type ProviderStats = {
  date: string;
  count: number;
  cpu: string;
  gpu: string;
  memory: string;
  storage: string;
};

export type ProviderActiveLeasesStats = {
  date: string;
  count: number;
};
