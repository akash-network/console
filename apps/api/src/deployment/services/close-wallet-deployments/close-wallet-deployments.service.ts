import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";

@singleton()
export class CloseWalletDeploymentsService {
  constructor(
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly chainErrorService: ChainErrorService
  ) {}

  /** An unsettleable escrow is skipped for this pass and fails the run at the end, so the queue retries the close later without blocking the other deployments. */
  async closeAllOf(wallet: UserWalletOutput): Promise<string[]> {
    const { address } = wallet;
    if (!address) return [];

    const dseqs = await this.#findOpenDseqs(address);
    const closed: string[] = [];
    const unsettleable: string[] = [];

    for (const dseq of dseqs) {
      try {
        await this.deploymentWriterService.close({ ...wallet, address }, dseq, { reason: null });
        closed.push(dseq);
      } catch (error) {
        if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
          unsettleable.push(dseq);
          continue;
        }
        throw error;
      }
    }

    if (unsettleable.length > 0) {
      throw new Error(`Deployments ${unsettleable.join(", ")} cannot be closed until their escrow settles`);
    }

    return closed;
  }

  /** Listed by deployment rather than by lease: a deployment whose bids never became a lease still holds escrow and would outlive the grants that pay for its close. */
  async #findOpenDseqs(owner: string): Promise<string[]> {
    const { deployments } = await this.deploymentHttpService.findAll({ owner, state: "active" });

    return deployments.map(deployment => deployment.deployment.id.dseq);
  }
}
