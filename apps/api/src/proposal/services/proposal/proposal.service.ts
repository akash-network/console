import { CosmosHttpService } from "@akashnetwork/http-sdk";
import axios from "axios";
import { singleton } from "tsyringe";

import { GetProposalByIdResponse, GetProposalListResponse } from "@src/proposal/http-schemas/proposal.schema";

/** gov v1 renders unset voting times as null; the retired v1beta1 endpoint emitted this zero value, which the public API contract keeps. */
const UNSET_TIMESTAMP = "0001-01-01T00:00:00Z";
const MSG_EXEC_LEGACY_CONTENT_TYPE = "/cosmos.gov.v1.MsgExecLegacyContent";

@singleton()
export class ProposalService {
  constructor(private readonly cosmosHttpService: CosmosHttpService) {}

  async getProposals(): Promise<GetProposalListResponse> {
    const proposalsFromCosmos = await this.cosmosHttpService.getProposals();
    const proposals = proposalsFromCosmos.map(x => ({
      id: parseInt(x.id),
      title: x.title,
      status: x.status,
      submitTime: x.submit_time,
      votingStartTime: x.voting_start_time ?? UNSET_TIMESTAMP,
      votingEndTime: x.voting_end_time ?? UNSET_TIMESTAMP,
      totalDeposit: parseInt(x.total_deposit[0]?.amount || "0")
    }));

    const sortedProposals = proposals.sort((a, b) => b.id - a.id);

    return sortedProposals;
  }

  async getProposalById(id: number): Promise<GetProposalByIdResponse | null> {
    try {
      const proposalFromCosmos = await this.cosmosHttpService.getProposal(id);

      let tally = null;
      if (proposalFromCosmos.status === "PROPOSAL_STATUS_VOTING_PERIOD") {
        const tallyFromCosmos = await this.cosmosHttpService.getProposalTally(id);

        tally = {
          yes: parseInt(tallyFromCosmos.yes_count) || 0,
          abstain: parseInt(tallyFromCosmos.abstain_count) || 0,
          no: parseInt(tallyFromCosmos.no_count) || 0,
          noWithVeto: parseInt(tallyFromCosmos.no_with_veto_count) || 0
        };
      } else {
        tally = {
          yes: parseInt(proposalFromCosmos.final_tally_result?.yes_count || "0") || 0,
          abstain: parseInt(proposalFromCosmos.final_tally_result?.abstain_count || "0") || 0,
          no: parseInt(proposalFromCosmos.final_tally_result?.no_count || "0") || 0,
          noWithVeto: parseInt(proposalFromCosmos.final_tally_result?.no_with_veto_count || "0") || 0
        };
      }

      return {
        id: parseInt(proposalFromCosmos.id),
        title: proposalFromCosmos.title,
        description: proposalFromCosmos.summary,
        status: proposalFromCosmos.status,
        submitTime: proposalFromCosmos.submit_time,
        votingStartTime: proposalFromCosmos.voting_start_time ?? UNSET_TIMESTAMP,
        votingEndTime: proposalFromCosmos.voting_end_time ?? UNSET_TIMESTAMP,
        totalDeposit: parseInt(proposalFromCosmos.total_deposit[0]?.amount || "0"),
        tally: { ...tally, total: tally.yes + tally.abstain + tally.no + tally.noWithVeto },
        paramChanges: proposalFromCosmos.messages
          .filter(message => message["@type"] === MSG_EXEC_LEGACY_CONTENT_TYPE)
          .flatMap(message => message.content?.changes ?? [])
          .map(change => ({
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
