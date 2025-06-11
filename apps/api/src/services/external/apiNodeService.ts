import axios from "axios";

import type { CosmosGovProposalResponse, CosmosGovProposalsResponse, RestGovProposalsTallyResponse } from "@src/types/rest";
import { apiNodeUrl } from "@src/utils/constants";

export async function getProposals() {
  const response = await axios.get<CosmosGovProposalsResponse>(`${apiNodeUrl}/cosmos/gov/v1beta1/proposals?pagination.limit=1000`);

  const proposals = response.data.proposals.map(x => ({
    id: parseInt(x.proposal_id),
    title: x.content.title,
    status: x.status,
    submitTime: x.submit_time,
    votingStartTime: x.voting_start_time,
    votingEndTime: x.voting_end_time,
    totalDeposit: parseInt(x.total_deposit[0].amount)
  }));

  const sortedProposals = proposals.sort((a, b) => b.id - a.id);

  return sortedProposals;
}

export async function getProposal(id: number) {
  try {
    const { data } = await axios.get<CosmosGovProposalResponse>(`${apiNodeUrl}/cosmos/gov/v1beta1/proposals/${id}`);

    // const proposer = null; // TODO: Fix
    // if (id > 3) {
    //   const proposerResponse = await fetch(`${apiNodeUrl}/gov/proposals/${id}/proposer`);
    //   const proposerData = await proposerResponse.json();
    //   const validatorFromDb = await Validator.findOne({ where: { accountAddress: proposerData.result.proposer } });
    //   proposer = {
    //     address: proposer,
    //     moniker: validatorFromDb?.moniker,
    //     operatorAddress: validatorFromDb?.operatorAddress,
    //     avatarUrl: validatorFromDb?.keybaseAvatarUrl
    //   };
    // }

    let tally = null;

    if (data.proposal.status === "PROPOSAL_STATUS_VOTING_PERIOD") {
      const { data: tallyData } = await axios.get<RestGovProposalsTallyResponse>(`${apiNodeUrl}/cosmos/gov/v1beta1/proposals/${id}/tally`);

      tally = {
        yes: parseInt(tallyData.tally.yes) || 0,
        abstain: parseInt(tallyData.tally.abstain) || 0,
        no: parseInt(tallyData.tally.no) || 0,
        noWithVeto: parseInt(tallyData.tally.no_with_veto) || 0
      };
    } else {
      tally = {
        yes: parseInt(data.proposal.final_tally_result?.yes || "0") || 0,
        abstain: parseInt(data.proposal.final_tally_result?.abstain || "0") || 0,
        no: parseInt(data.proposal.final_tally_result?.no || "0") || 0,
        noWithVeto: parseInt(data.proposal.final_tally_result?.no_with_veto || "0") || 0
      };
    }

    return {
      id: parseInt(data.proposal.proposal_id),
      title: data.proposal.content.title,
      description: data.proposal.content.description,
      status: data.proposal.status,
      submitTime: data.proposal.submit_time,
      votingStartTime: data.proposal.voting_start_time,
      votingEndTime: data.proposal.voting_end_time,
      totalDeposit: parseInt(data.proposal.total_deposit[0].amount),
      //proposer: proposer,
      tally: { ...tally, total: tally.yes + tally.abstain + tally.no + tally.noWithVeto },
      paramChanges: (data.proposal.content.changes || []).map(change => ({
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
