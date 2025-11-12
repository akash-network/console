"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFriendlyProposalType = getFriendlyProposalType;
exports.getFriendlyProposalStatus = getFriendlyProposalStatus;
exports.getProposalParamChangeValue = getProposalParamChangeValue;
function getFriendlyProposalType(typeUrl) {
    return typeUrl.split(".")[typeUrl.split(".").length - 1].split("Proposal")[0];
}
function getFriendlyProposalStatus(status) {
    switch (status) {
        case "PROPOSAL_STATUS_VOTING_PERIOD":
            return "VOTING";
        default:
            return status.split("PROPOSAL_STATUS_")[1];
    }
}
function getProposalParamChangeValue(value) {
    if (typeof value === "string") {
        return value;
    }
    else if (Array.isArray(value)) {
        return value.join(",");
    }
    else {
        return JSON.stringify(value);
    }
}
