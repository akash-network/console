import type { QueryDeploymentResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { DeploymentPresenceService } from "./deployment-presence.service";

const OWNER = "akash100dwtg4hqnd240x583spjwnk4kanp559xwtvmg";
const DSEQ = "16122570";

/** The shapes a real node produced for each outcome, captured against mainnet REST and replayed here. */
const CHAIN_ANSWERS = {
  absent: new SDKError("[not_found] codespace deployment code 4: Deployment not found", SDKErrorCode.NotFound),
  unroutableQueryVersion: new SDKError("[unimplemented] Not Implemented", SDKErrorCode.Unimplemented),
  unreachableNode: new SDKError("[unknown] fetch failed", SDKErrorCode.Unknown),
  timedOut: new SDKError("[deadline_exceeded] the operation timed out", SDKErrorCode.DeadlineExceeded),
  malformedOwner: new SDKError("[invalid_argument] invalid owner address", SDKErrorCode.InvalidArgument)
};

describe(DeploymentPresenceService.name, () => {
  it("reports a deployment the chain answers for as on chain", async () => {
    const { service } = setup({ answers: mockDeep<QueryDeploymentResponse>() });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).resolves.toBe(true);
  });

  it("reports a deployment the chain says it does not have as absent", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.absent });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).resolves.toBe(false);
  });

  it("asks the chain for the deployment the caller named, with dseq as a number", async () => {
    const { service, chainSdk } = setup({ answers: mockDeep<QueryDeploymentResponse>() });

    await service.isOnChain({ owner: OWNER, dseq: DSEQ });

    expect(chainSdk.akash.deployment.v1beta4.getDeployment).toHaveBeenCalledWith({ id: { owner: OWNER, dseq: 16122570n } });
  });

  it("refuses to answer when the node cannot be reached", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.unreachableNode });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).rejects.toThrow(CHAIN_ANSWERS.unreachableNode);
  });

  it("refuses to answer when the request timed out", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.timedOut });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).rejects.toThrow(CHAIN_ANSWERS.timedOut);
  });

  it("refuses to answer when the node does not serve this query version", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.unroutableQueryVersion });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).rejects.toThrow(CHAIN_ANSWERS.unroutableQueryVersion);
  });

  it("refuses to answer when the node rejected the request as malformed", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.malformedOwner });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).rejects.toThrow(CHAIN_ANSWERS.malformedOwner);
  });

  it("refuses to answer on an error shape it does not recognise", async () => {
    const { service } = setup({ rejectsWith: new Error("Deployment not found") });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).rejects.toThrow("Deployment not found");
  });

  it("refuses to answer when something other than an error was thrown", async () => {
    const { service } = setup({ rejectsWith: { code: SDKErrorCode.NotFound, message: "Deployment not found" } });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ })).rejects.toEqual({
      code: SDKErrorCode.NotFound,
      message: "Deployment not found"
    });
  });

  function setup(input: { answers?: QueryDeploymentResponse; rejectsWith?: unknown }) {
    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.akash.deployment.v1beta4.getDeployment.mockImplementation(async () => {
      if (input.answers) return input.answers;
      throw input.rejectsWith;
    });

    const service = new DeploymentPresenceService(chainSdk);

    return { service, chainSdk };
  }
});
