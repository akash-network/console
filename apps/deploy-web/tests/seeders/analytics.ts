import type { AnalyticsService as RealAnalyticsService } from "@src/services/analytics/analytics.service";

export interface AnalyticsService {
  track: jest.MockedFunction<RealAnalyticsService["track"]>;
}

export const buildAnalyticsService = (overrides: Partial<AnalyticsService> = {}): AnalyticsService => ({
  track: jest.fn() as jest.MockedFunction<RealAnalyticsService["track"]>,
  ...overrides
});
