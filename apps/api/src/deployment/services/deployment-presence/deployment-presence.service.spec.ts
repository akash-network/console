import type { QueryDeploymentResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { GetLatestBlockResponse } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { addMinutes, subMinutes } from "date-fns";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { DeploymentPresenceService } from "./deployment-presence.service";

const OWNER = "akash100dwtg4hqnd240x583spjwnk4kanp559xwtvmg";
const DSEQ = "16122570";
const RECORDED_AT = new Date("2026-01-01T00:00:00.000Z");
const CHAIN_HEIGHT = 28343549n;

/** The margin the service requires between the record and the block it will trust, kept in step with it. */
const MARGIN_IN_MIN = 10;

/** The shapes a real node produced for each outcome, captured against mainnet REST and replayed here. */
const CHAIN_ANSWERS = {
  absent: new SDKError("[not_found] codespace deployment code 4: Deployment not found", SDKErrorCode.NotFound),
  heightAboveTheirChain: new SDKError("[unknown] codespace sdk code 26: invalid height: cannot query with height in the future", SDKErrorCode.Unknown),
  heightPruned: new SDKError("[unknown] codespace sdk code 38: not found: failed to load state at height", SDKErrorCode.Unknown),
  unroutableQueryVersion: new SDKError("[unimplemented] Not Implemented", SDKErrorCode.Unimplemented),
  unreachableNode: new SDKError("[unknown] fetch failed", SDKErrorCode.Unknown),
  timedOut: new SDKError("[deadline_exceeded] The operation was aborted due to timeout", SDKErrorCode.DeadlineExceeded),
  malformedOwner: new SDKError("[invalid_argument] invalid owner address", SDKErrorCode.InvalidArgument)
};

describe(DeploymentPresenceService.name, () => {
  it("reports a deployment the chain answers for as on chain", async () => {
    const { service } = setup({ answers: mockDeep<QueryDeploymentResponse>() });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).resolves.toBe(true);
  });

  it("reports a deployment the chain says it does not have as absent", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.absent });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).resolves.toBe(false);
  });

  it("asks the chain for the deployment the caller named, with dseq as a number", async () => {
    const { service, chainSdk } = setup({ answers: mockDeep<QueryDeploymentResponse>() });

    await service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT });

    expect(chainSdk.akash.deployment.v1beta4.getDeployment).toHaveBeenCalledWith({ id: { owner: OWNER, dseq: 16122570n } }, expect.anything());
  });

  it("pins the lookup to the height it proved is past the record, so a shorter chain must refuse it", async () => {
    const { service, chainSdk } = setup({ rejectsWith: CHAIN_ANSWERS.absent });

    await service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT });

    expect(chainSdk.akash.deployment.v1beta4.getDeployment).toHaveBeenCalledWith(expect.anything(), {
      header: { "x-cosmos-block-height": CHAIN_HEIGHT.toString() }
    });
  });

  it("refuses to answer when the chain has not yet progressed past the record", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.absent, chainTime: subMinutes(RECORDED_AT, 1) });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(/not past/);
  });

  it("refuses to answer when the chain has progressed past the record but not past the margin", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.absent, chainTime: addMinutes(RECORDED_AT, MARGIN_IN_MIN - 1) });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(/not past/);
  });

  it("looks the deployment up at all only once the chain is past the margin", async () => {
    const { service, chainSdk } = setup({ rejectsWith: CHAIN_ANSWERS.absent, chainTime: addMinutes(RECORDED_AT, MARGIN_IN_MIN - 1) });

    await service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT }).catch(() => undefined);

    expect(chainSdk.akash.deployment.v1beta4.getDeployment).not.toHaveBeenCalled();
  });

  it("refuses to answer when the chain does not report a latest block time", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.absent, chainTime: null });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(/did not report a latest block time/);
  });

  it("refuses to answer when the latest block cannot be read", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.absent, latestBlockRejectsWith: CHAIN_ANSWERS.unreachableNode });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(CHAIN_ANSWERS.unreachableNode);
  });

  it("refuses to answer when the answering node has not reached the pinned height", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.heightAboveTheirChain });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(CHAIN_ANSWERS.heightAboveTheirChain);
  });

  it("refuses to answer when the answering node has pruned the pinned height", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.heightPruned });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(CHAIN_ANSWERS.heightPruned);
  });

  it("refuses to answer when the node cannot be reached", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.unreachableNode });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(CHAIN_ANSWERS.unreachableNode);
  });

  it("refuses to answer when the request timed out", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.timedOut });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(CHAIN_ANSWERS.timedOut);
  });

  it("refuses to answer when the node does not serve this query version", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.unroutableQueryVersion });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(CHAIN_ANSWERS.unroutableQueryVersion);
  });

  it("refuses to answer when the node rejected the request as malformed", async () => {
    const { service } = setup({ rejectsWith: CHAIN_ANSWERS.malformedOwner });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow(CHAIN_ANSWERS.malformedOwner);
  });

  it("refuses to answer on an error shape it does not recognise", async () => {
    const { service } = setup({ rejectsWith: new Error("Deployment not found") });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toThrow("Deployment not found");
  });

  it("refuses to answer when something other than an error was thrown", async () => {
    const { service } = setup({ rejectsWith: { code: SDKErrorCode.NotFound, message: "Deployment not found" } });

    await expect(service.isOnChain({ owner: OWNER, dseq: DSEQ, recordedAt: RECORDED_AT })).rejects.toEqual({
      code: SDKErrorCode.NotFound,
      message: "Deployment not found"
    });
  });

  function setup(input: { answers?: QueryDeploymentResponse; rejectsWith?: unknown; chainTime?: Date | null; latestBlockRejectsWith?: unknown }) {
    const chainTime = input.chainTime === undefined ? addMinutes(RECORDED_AT, MARGIN_IN_MIN + 1) : input.chainTime;
    const chainSdk = mockDeep<ChainSDK>();

    chainSdk.cosmos.base.tendermint.v1beta1.getLatestBlock.mockImplementation(async () => {
      if (input.latestBlockRejectsWith) throw input.latestBlockRejectsWith;

      return mockDeep<GetLatestBlockResponse>({
        block: { header: { height: CHAIN_HEIGHT, time: chainTime ?? undefined } }
      });
    });

    chainSdk.akash.deployment.v1beta4.getDeployment.mockImplementation(async () => {
      if (input.answers) return input.answers;
      throw input.rejectsWith;
    });

    const service = new DeploymentPresenceService(chainSdk);

    return { service, chainSdk };
  }
});
