import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import type { AlertConfig } from "@src/modules/alert/config";

/** Must match the header console-api's internal routes read their token from. */
const INTERNAL_TOKEN_HEADER = "x-console-internal-token";

const DeploymentNameResponseSchema = z.object({ name: z.string().nullable() });

/** The tenant of the alert asking, which console-api checks the deployment against, since any user can set an alert on any owner. */
export type DeploymentNameReader = { userId: string; organizationId: string | null };

@Injectable()
export class DeploymentNameClient {
  readonly #endpoint: { baseUrl: string; token: string } | undefined;

  constructor(private readonly configService: ConfigService<AlertConfig>) {
    const baseUrl = this.configService.get("alert.CONSOLE_API_BASE_URL");
    const token = this.configService.get("alert.CONSOLE_API_INTERNAL_TOKEN");

    this.#endpoint = baseUrl && token ? { baseUrl: baseUrl.replace(/\/+$/, ""), token } : undefined;
  }

  /** Null without calling console-api when its settings are unset, so such an environment names deployments by their dseq. */
  async findName({ owner, dseq, reader }: { owner: string; dseq: string; reader: DeploymentNameReader }): Promise<string | null> {
    if (!this.#endpoint) return null;

    const query = new URLSearchParams({ userId: reader.userId, ...(reader.organizationId && { organizationId: reader.organizationId }) });
    const response = await fetch(`${this.#endpoint.baseUrl}/internal/deployment-names/${encodeURIComponent(owner)}/${encodeURIComponent(dseq)}?${query}`, {
      headers: { [INTERNAL_TOKEN_HEADER]: this.#endpoint.token },
      redirect: "manual",
      signal: AbortSignal.timeout(this.configService.getOrThrow("alert.CONSOLE_API_TIMEOUT_MS"))
    });

    if (!response.ok) {
      throw new Error(`console-api answered ${response.status}: ${await response.text()}`);
    }

    return DeploymentNameResponseSchema.parse(await response.json()).name;
  }
}
