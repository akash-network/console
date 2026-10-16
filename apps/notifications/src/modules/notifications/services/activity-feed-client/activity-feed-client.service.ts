import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { NotificationsConfig } from "@src/modules/notifications/config";

/** Must stay within the alert types console-api's activity feed accepts. */
export const ALERT_ACTIVITY_TYPES = ["wallet_balance_alert", "deployment_closed_alert", "deployment_reclaim_alert"] as const;

export type AlertActivityType = (typeof ALERT_ACTIVITY_TYPES)[number];

export type AlertActivity = {
  userId: string;
  organizationId: string | null;
  projectId: string | null;
  type: AlertActivityType;
  dedupeKey: string;
  meta: { alertId: string; summary: string; dseq?: string };
};

/** Must match the header console-api's internal routes read their token from. */
const INTERNAL_TOKEN_HEADER = "x-console-internal-token";

@Injectable()
export class ActivityFeedClient {
  readonly #endpoint: { url: string; token: string } | undefined;

  constructor(private readonly configService: ConfigService<NotificationsConfig>) {
    const baseUrl = this.configService.get("notifications.CONSOLE_API_BASE_URL");
    const token = this.configService.get("notifications.CONSOLE_API_INTERNAL_TOKEN");

    this.#endpoint = baseUrl && token ? { url: `${baseUrl.replace(/\/+$/, "")}/internal/activities`, token } : undefined;
  }

  get isConfigured(): boolean {
    return this.#endpoint !== undefined;
  }

  async addAlert(activity: AlertActivity): Promise<void> {
    if (!this.#endpoint) {
      throw new Error("CONSOLE_API_BASE_URL and CONSOLE_API_INTERNAL_TOKEN must both be set to write to the activity feed");
    }

    const response = await fetch(this.#endpoint.url, {
      method: "POST",
      headers: { "content-type": "application/json", [INTERNAL_TOKEN_HEADER]: this.#endpoint.token },
      body: JSON.stringify({ ...activity, status: "info" }),
      redirect: "manual",
      signal: AbortSignal.timeout(this.configService.getOrThrow("notifications.CONSOLE_API_TIMEOUT_MS"))
    });

    if (!response.ok) {
      throw new Error(`console-api answered ${response.status}: ${await response.text()}`);
    }
  }
}
