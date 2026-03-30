import { singleton } from "tsyringe";

import { BlockchainStatusService } from "../../services/blockchain-status/blockchain-status.service";

@singleton()
export class BlockchainStatusController {
  readonly #blockchainStatusService: BlockchainStatusService;

  constructor(blockchainStatusService: BlockchainStatusService) {
    this.#blockchainStatusService = blockchainStatusService;
  }

  async getStatus() {
    return this.#blockchainStatusService.getStatus();
  }
}
