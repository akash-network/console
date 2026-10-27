import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertConfig } from "@src/modules/alert/config";
import { DeploymentNameClient } from "@src/modules/alert/services/deployment-name-client/deployment-name-client.service";

export type DeploymentReference = {
  /** Raw text a user may have typed, so it is escaped wherever it goes into markup. */
  label: string;
  link: string;
};

export type DeploymentReferenceInput = {
  owner: string;
  dseq: string;
  userId: string;
  organizationId: string | null;
  tab?: "SETTINGS";
};

@Injectable()
export class DeploymentReferenceService {
  constructor(
    private readonly deploymentNameClient: DeploymentNameClient,
    private readonly configService: ConfigService<AlertConfig>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(DeploymentReferenceService.name);
  }

  async referTo({ owner, dseq, userId, organizationId, tab }: DeploymentReferenceInput): Promise<DeploymentReference> {
    const name = await this.#findName({ owner, dseq, reader: { userId, organizationId } });

    return {
      label: name ? `“${name}”` : dseq,
      link: this.#linkTo(dseq, { tab, org: organizationId })
    };
  }

  /** A failed lookup names the deployment by its dseq rather than holding its alert back. */
  async #findName(lookup: Parameters<DeploymentNameClient["findName"]>[0]): Promise<string | null> {
    try {
      return await this.deploymentNameClient.findName(lookup);
    } catch (error) {
      this.loggerService.warn({ event: "DEPLOYMENT_NAME_LOOKUP_FAILED", owner: lookup.owner, dseq: lookup.dseq, error });
      return null;
    }
  }

  /** Carries the alert's organization because console-web looks a deployment up in the active organization, which may be another one. */
  #linkTo(dseq: string, query: { tab?: string; org: string | null }): string {
    const baseUrl = this.configService.getOrThrow("alert.CONSOLE_WEB_URL");
    const search = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => !!entry[1])).toString();

    return `<a href="https://${baseUrl}/deployments/${dseq}${search ? `?${search}` : ""}">${baseUrl}</a>`;
  }
}
