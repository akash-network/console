import type { Bid } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { CORE_CONFIG, JOB_NAME } from "@src/core";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { CreateLeaseHandler } from "@src/deployment/services/create-lease/create-lease.handler";
import { CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import { ReconcileLeaseCreate } from "@src/deployment/services/reconcile-lease-create/reconcile-lease-create.job";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const HELLO_WORLD_SDL = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

const jobWorkers = useJobWorkers(() => [container.resolve(CreateLeaseHandler)]);

describe("POST /v1/leases?async=true", () => {
  const activityRepository = container.resolve(ActivityRepository);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("answers 202 with the activity to follow, opening it pending and queueing the leases without creating them", async () => {
    const { postLeases, user, address, dseq, provider, signerService, providerService } = await setup();

    const response = await postLeases({ async: true });
    const { data } = (await response.json()) as { data: { activityId: string } };

    expect(response.status).toBe(202);
    expect(await activityRepository.findById(data.activityId)).toMatchObject({
      userId: user.id,
      type: "lease_create",
      status: "pending",
      meta: { dseq, providers: [provider] }
    });
    expect(await findJobRows(CreateLease[JOB_NAME], { singletonKey: createLeaseKeyFor({ owner: address, dseq }) })).toEqual([
      expect.objectContaining({ state: "created", data: expect.objectContaining({ userId: user.id, activityId: data.activityId }) })
    ]);
    expect(await findJobRows(ReconcileLeaseCreate[JOB_NAME], { data: { activityId: data.activityId } })).toHaveLength(1);
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    expect(providerService.sendManifest).not.toHaveBeenCalled();
  });

  it("answers a refused request exactly as without background mode, recording and queueing nothing", async () => {
    const { postLeases, user, address, dseq } = await setup({ bidState: "closed" });

    const inBackground = await postLeases({ async: true });
    const duringRequest = await postLeases({ async: false });

    expect(inBackground.status).toBe(400);
    expect(await inBackground.json()).toEqual(await duringRequest.json());
    expect(await activityRepository.find({ userId: user.id })).toEqual([]);
    expect(await findJobRows(CreateLease[JOB_NAME], { singletonKey: createLeaseKeyFor({ owner: address, dseq }) })).toEqual([]);
  });

  it("creates the leases during the request and answers with the deployment when background leases are switched off", async () => {
    const { postLeases, user, address, dseq, providerService } = await setup();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(false);

    const response = await postLeases({ async: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { deployment: { id: { owner: address, dseq } }, leases: [] } });
    expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
    expect(await findJobRows(CreateLease[JOB_NAME], { singletonKey: createLeaseKeyFor({ owner: address, dseq }) })).toEqual([]);
    expect(await activityRepository.find({ userId: user.id })).toEqual([expect.objectContaining({ type: "lease_create", status: "succeeded" })]);
  });

  it("creates the leases, sends the manifest and settles the activity as succeeded once the worker runs", async () => {
    const { postLeases, address, dseq, signerService, providerService } = await setup();
    const { startWorkers } = await jobWorkers();

    const response = await postLeases({ async: true });
    const { data } = (await response.json()) as { data: { activityId: string } };
    await startWorkers();

    await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey: createLeaseKeyFor({ owner: address, dseq }) });
    expect(await activityRepository.findById(data.activityId)).toMatchObject({ status: "succeeded" });
    expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith(expect.any(String), [
      expect.objectContaining({ typeUrl: expect.stringContaining("MsgCreateLease") })
    ]);
    expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ dseq, manifest: expect.stringContaining('"name":"web"') }));
  });

  async function setup(input: { bidState?: Bid["bid"]["state"] } = {}) {
    const { user, wallet, address } = await seedUserWithWallet({ user: { userId: faker.string.uuid() } });
    const dseq = createDseq();
    const provider = createAkashAddress();
    await seedDeploymentSetting({ userId: user.id, dseq, sdl: HELLO_WORLD_SDL, manifestVersion: "AAAA" });
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : null
    );
    mockChain({ owner: address, dseq, provider, bidState: input.bidState });

    const signerService = container.resolve(ManagedSignerService);
    vi.spyOn(signerService, "assertCanBroadcast").mockResolvedValue(undefined);
    vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValue({ code: 0, hash: "ABCDEF", transactionHash: "ABCDEF", rawLog: "" });
    const providerService = container.resolve(ProviderService);
    vi.spyOn(providerService, "assertReachable").mockResolvedValue(undefined);
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);

    return {
      user,
      wallet,
      address,
      dseq,
      provider,
      signerService: vi.mocked(signerService),
      providerService: vi.mocked(providerService),
      postLeases: async ({ async }: { async: boolean }) =>
        await app.request(`/v1/leases${async ? "?async=true" : ""}`, {
          method: "POST",
          body: JSON.stringify({ leases: [{ dseq, gseq: 1, oseq: 1, provider }] }),
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }
        })
    };
  }

  function mockChain({ owner, dseq, provider, bidState }: { owner: string; dseq: string; provider: string; bidState?: Bid["bid"]["state"] }) {
    const restUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const bid = createBid({ owner, dseq, gseq: 1, oseq: 1, provider });
    if (bidState) bid.bid.state = bidState;

    nock(restUrl)
      .persist()
      .get(`/akash/market/${marketVersion}/bids/list`)
      .query(query => query["filters.owner"] === owner && query["filters.dseq"] === dseq)
      .reply(200, { bids: [bid], pagination: { next_key: null, total: "1" } });
    nock(restUrl)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list`)
      .query(query => query["filters.owner"] === owner && query["filters.dseq"] === dseq)
      .reply(200, { leases: [], pagination: { next_key: null, total: "0" } });
    nock(restUrl)
      .persist()
      .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${owner}&id.dseq=${dseq}`)
      .reply(200, createDeploymentInfoSeed({ owner, dseq }));
  }
});
