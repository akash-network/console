import { browserEnvConfig } from "@src/config/browser-env.config";

export class AnalyticsService {
  constructor(private readonly tagId?: string) {}

  setUser(userId: string): void {
    if (this.tagId && typeof window !== "undefined") {
      window.gtag("config", this.tagId, { user_id: userId });
    }
  }
}

export const analyticsService = new AnalyticsService(browserEnvConfig.NEXT_PUBLIC_GA_MEASUREMENT_ID);
