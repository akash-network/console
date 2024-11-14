import { singleton } from "tsyringe";

import { DeploymentConfig, InjectDeploymentConfig } from "@src/deployment/config/config.provider";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { BlockHttpService } from "../block-http/block-http.service";

@singleton()
export class DrainingDeploymentService {
  constructor(
    private readonly blockHttpService: BlockHttpService,
    private readonly leaseRepository: LeaseRepository,
    @InjectDeploymentConfig() private readonly config: DeploymentConfig
  ) {}

  async findDeployments(owner: string, denom: string): Promise<DrainingDeploymentOutput[]> {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const closureHeight = Math.floor(currentHeight + averageBlockCountInAnHour * this.config.AUTO_TOP_UP_JOB_INTERVAL_IN_H);

    return await this.leaseRepository.findDrainingLeases({ owner, closureHeight, denom });
  }

  async calculateTopUpAmount(deployment: Pick<DrainingDeploymentOutput, "blockRate">): Promise<number> {
    return Math.floor(deployment.blockRate * (averageBlockCountInAnHour * 24 * this.config.AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_DAYS));
  }
}
