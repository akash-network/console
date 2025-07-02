import { singleton } from "tsyringe";

import { GetProposalByIdResponse, GetProposalListResponse } from "@src/proposal/http-schemas/proposal.schema";
import { ProposalService } from "@src/proposal/services/proposal/proposal.service";

@singleton()
export class ProposalController {
  constructor(private readonly proposalService: ProposalService) {}

  async getProposals(): Promise<GetProposalListResponse> {
    return await this.proposalService.getProposals();
  }

  async getProposalById(id: number): Promise<GetProposalByIdResponse | null> {
    return await this.proposalService.getProposalById(id);
  }
}
