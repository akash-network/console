import axios from "axios";
import { singleton } from "tsyringe";

import { CosmosHttpServiceWrapper } from "@src/core/services/http-service-wrapper/http-service-wrapper";
import { GetProposalByIdResponse, GetProposalListResponse } from "@src/proposal/http-schemas/proposal.schema";

@singleton()
export class ProposalService {
  constructor(private readonly cosmosHttpServiceWrapper: CosmosHttpServiceWrapper) {}

  async getProposals(): Promise<GetProposalListResponse> {
    const proposalsFromCosmos = await this.cosmosHttpServiceWrapper.getProposals();
    const proposals = proposalsFromCosmos.map(x => ({
      id: parseInt(x.proposal_id),
      title: x.content.title,
      status: x.status,
      submitTime: x.submit_time,
      votingStartTime: x.voting_start_time,
      votingEndTime: x.voting_end_time,
      totalDeposit: parseInt(x.total_deposit[0]?.amount || "0")
    }));

    const sortedProposals = proposals.sort((a, b) => b.id - a.id);

    return sortedProposals;
  }

  async getProposalById(id: number): Promise<GetProposalByIdResponse | null> {
    try {
      const proposalFromCosmos = await this.cosmosHttpServiceWrapper.getProposal(id);

      let tally = null;
      if (proposalFromCosmos.status === "PROPOSAL_STATUS_VOTING_PERIOD") {
        const tallyFromCosmos = await this.cosmosHttpServiceWrapper.getProposalTally(id);

        tally = {
          yes: parseInt(tallyFromCosmos.yes) || 0,
          abstain: parseInt(tallyFromCosmos.abstain) || 0,
          no: parseInt(tallyFromCosmos.no) || 0,
          noWithVeto: parseInt(tallyFromCosmos.no_with_veto) || 0
        };
      } else {
        tally = {
          yes: parseInt(proposalFromCosmos.final_tally_result?.yes || "0") || 0,
          abstain: parseInt(proposalFromCosmos.final_tally_result?.abstain || "0") || 0,
          no: parseInt(proposalFromCosmos.final_tally_result?.no || "0") || 0,
          noWithVeto: parseInt(proposalFromCosmos.final_tally_result?.no_with_veto || "0") || 0
        };
      }

      return {
        id: parseInt(proposalFromCosmos.proposal_id),
        title: proposalFromCosmos.content.title,
        description: proposalFromCosmos.content.description,
        status: proposalFromCosmos.status,
        submitTime: proposalFromCosmos.submit_time,
        votingStartTime: proposalFromCosmos.voting_start_time,
        votingEndTime: proposalFromCosmos.voting_end_time,
        totalDeposit: parseInt(proposalFromCosmos.total_deposit[0]?.amount || "0"),
        tally: { ...tally, total: tally.yes + tally.abstain + tally.no + tally.noWithVeto },
        paramChanges: (proposalFromCosmos.content.changes || []).map(change => ({
          subspace: change.subspace,
          key: change.key,
          value: JSON.parse(change.value)
        }))
      };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return null;
      } else {
        throw err;
      }
    }
  }
}
