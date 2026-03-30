import { singleton } from "tsyringe";

import { BlockchainStatusService } from "../../services/blockchain-status/blockchain-status.service";

@singleton()
export class BlockchainStatusController {
  constructor(private readonly blockchainStatusService: BlockchainStatusService) {}

  async getStatus() {
    return this.blockchainStatusService.getStatus();
  }
}
