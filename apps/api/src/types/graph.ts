export type ProviderStatsKey = keyof Omit<ProviderStats, "date">;

export type ProviderStats = {
  date: Date;
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
