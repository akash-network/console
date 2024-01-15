export function getFriendlyProposalType(typeUrl: string) {
  return typeUrl.split(".")[typeUrl.split(".").length - 1].split("Proposal")[0];
}

export function getFriendlyProposalStatus(status: string) {
  switch (status) {
    case "PROPOSAL_STATUS_VOTING_PERIOD":
      return "VOTING";
    default:
      return status.split("PROPOSAL_STATUS_")[1];
  }
}

export function getProposalParamChangeValue(value: any) {
  if (typeof value === "string") {
    return value;
  } else if (Array.isArray(value)) {
    return value.join(",");
  } else {
    return JSON.stringify(value);
  }
}
