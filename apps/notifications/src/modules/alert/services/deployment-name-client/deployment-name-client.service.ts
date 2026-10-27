import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import type { AlertConfig } from "@src/modules/alert/config";

/** Must match the header console-api's internal routes read their token from. */
const INTERNAL_TOKEN_HEADER = "x-console-internal-token";

const DeploymentNameResponseSchema = z.object({ name: z.string().nullable() });

@Injectable()
export class DeploymentNameClient {
  readonly #endpoint: { baseUrl: string; token: string } | undefined;

  constructor(private readonly configService: ConfigService<AlertConfig>) {
    const baseUrl = this.configService.get("alert.CONSOLE_API_BASE_URL");
    const token = this.configService.get("alert.CONSOLE_API_INTERNAL_TOKEN");

    this.#endpoint = baseUrl && token ? { baseUrl: baseUrl.replace(/\/+$/, ""), token } : undefined;
  }

  /** Null without calling console-api when its settings are unset, so such an environment names deployments by their dseq. */
  async findName({ owner, dseq }: { owner: string; dseq: string }): Promise<string | null> {
    if (!this.#endpoint) return null;

    const response = await fetch(`${this.#endpoint.baseUrl}/internal/deployment-names/${encodeURIComponent(owner)}/${encodeURIComponent(dseq)}`, {
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
