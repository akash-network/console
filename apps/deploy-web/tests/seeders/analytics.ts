export interface AnalyticsService {
  track: (event: string, properties?: Record<string, any>) => void;
}

export const buildAnalyticsService = (overrides: Partial<AnalyticsService> = {}): AnalyticsService => ({
  track: jest.fn(),
  ...overrides
});
