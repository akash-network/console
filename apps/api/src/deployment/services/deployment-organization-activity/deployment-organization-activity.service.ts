import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  DeploymentSettingRepository,
  type DeploymentSettingsOutput,
  type DeploymentWallet
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";

/** Why the console closed a deployment on its own, which the activity feed words for its readers. */
export type ConsoleCloseReason = "runtime_limit_reached" | "trial_ended" | "provider_unreachable";

/** Marks a close the console made on its own rather than one the wallet's owner asked for. */
export type ConsoleClose = { reason: ConsoleCloseReason | null };

/** A deployment named by the wallet that owns it on chain, whose activity never lands outside that wallet's tenant. */
export type WalletDeploymentKey = { wallet: DeploymentWallet; dseq: string };

export type DeploymentCloser = { actorUserId: string | null; reason: ConsoleCloseReason | null };

type FiledDeployment = DeploymentSettingsOutput & { organizationId: string };

@singleton()
export class DeploymentOrganizationActivityService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly organizationActivityService: OrganizationActivityService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: DeploymentOrganizationActivityService.name });
  }

  async recordCreated(key: WalletDeploymentKey, actorUserId: string): Promise<void> {
    await this.#recordFor(key, "deployment_created", async deployment => {
      await this.organizationActivityService.recordForDeployment({
        organizationId: deployment.organizationId,
        projectId: deployment.projectId,
        type: "deployment_created",
        actorUserId,
        payload: { dseq: key.dseq, name: deployment.name }
      });
    });
  }

  async recordClosed(key: WalletDeploymentKey, closer: DeploymentCloser): Promise<void> {
    await this.#recordFor(key, "deployment_closed", async deployment => {
      await this.organizationActivityService.recordForDeployment({
        organizationId: deployment.organizationId,
        projectId: deployment.projectId,
        type: "deployment_closed",
        actorUserId: closer.actorUserId,
        payload: { dseq: key.dseq, name: deployment.name, reason: closer.reason }
      });
    });
  }

  /** The deployment already changed on chain by the time this runs, so a failure to record it is logged rather than raised. */
  async #recordFor({ wallet, dseq }: WalletDeploymentKey, type: string, record: (deployment: FiledDeployment) => Promise<void>): Promise<void> {
    try {
      const deployment = await this.deploymentSettingRepository.unscoped("deployment-activity").findOneOwnedByWallet(wallet, dseq);

      if (!deployment?.organizationId) return;

      await record({ ...deployment, organizationId: deployment.organizationId });
    } catch (error) {
      this.#logger.error({
        event: "DEPLOYMENT_ORGANIZATION_ACTIVITY_RECORD_FAILED",
        walletUserId: wallet.userId,
        organizationId: wallet.organizationId,
        dseq,
        type,
        error
      });
    }
  }
}
