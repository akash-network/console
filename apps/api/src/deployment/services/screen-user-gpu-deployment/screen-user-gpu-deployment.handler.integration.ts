import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { CORE_CONFIG, JOB_NAME } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import {
  RecordUserGpuBids,
  RecordUserGpuBidsHandler,
  recordUserGpuBidsKeyFor
} from "@src/deployment/services/record-user-gpu-bids/record-user-gpu-bids.handler";
import { ScreenUserGpuDeployment, ScreenUserGpuDeploymentHandler, screenUserGpuDeploymentKeyFor } from "./screen-user-gpu-deployment.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ScreenUserGpuDeploymentHandler), container.resolve(RecordUserGpuBidsHandler)]);

describe(ScreenUserGpuDeploymentHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("schedules the bid read of an active gpu deployment with the providers screening lists, run the way a worker runs it", async () => {
    const { owner, dseq, runJob, answerChainWith, recordJobs } = await setup();
    const screened = [createAkashAddress(), createAkashAddress()];
    answerChainWith({ state: "active", openGseqs: [1], screened });

    await runJob();

    expect(await recordJobs()).toEqual([
      expect.objectContaining({
        state: "created",
        data: { owner, dseq, groups: [{ gseq: 1, vendor: "nvidia", model: "h100", screened, wasOpenThroughWait: true }], version: 1 }
      })
    ]);
  });

  it("schedules nothing for a deployment closed before the wait ended", async () => {
    const { runJob, answerChainWith, recordJobs } = await setup();
    answerChainWith({ state: "closed", openGseqs: [], screened: [] });

    await runJob();

    expect(await recordJobs()).toEqual([]);
  });

  async function setup() {
    const owner = createAkashAddress();
    const dseq = createDseq();
    const { enqueue, startWorkers } = await jobWorkers();
    const singletonKey = screenUserGpuDeploymentKeyFor(owner, dseq);

    function answerChainWith(input: { state: "active" | "closed"; openGseqs: number[]; screened: string[] }) {
      const chain = nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL);
      chain
        .get("/akash/deployment/v1beta4/deployments/info")
        .query({ "id.owner": owner, "id.dseq": dseq })
        .reply(200, {
          deployment: { id: { owner, dseq }, state: input.state, hash: "bLTCo5xFV2obtovLJ/rUZDHLkzAbB8vlXpF2iJGKpaY=", created_at: "16122572" },
          groups: [{ id: { owner, dseq, gseq: 1 }, state: "open", group_spec: GPU_GROUP_SPEC, created_at: "16122572" }],
          escrow_account: null
        });
      chain
        .get("/akash/market/v1beta5/orders/list")
        .query(query => query["filters.owner"] === owner && query["filters.dseq"] === dseq && query["filters.state"] === "open")
        .reply(200, {
          orders: input.openGseqs.map(gseq => ({ id: { owner, dseq, gseq, oseq: 1 }, state: "open", spec: GPU_GROUP_SPEC, created_at: "16122572" })),
          pagination: { next_key: null, total: String(input.openGseqs.length) }
        });
      nock(container.resolve(DeploymentConfigService).get("PROVIDER_INVENTORY_API_URL"))
        .post("/v1/bid-screening")
        .reply(200, { providers: input.screened.map(provider => ({ owner: provider })) });
    }

    async function runJob() {
      await enqueue(new ScreenUserGpuDeployment({ owner, dseq }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(ScreenUserGpuDeployment[JOB_NAME], { singletonKey });
    }

    return {
      owner,
      dseq,
      answerChainWith,
      runJob,
      recordJobs: () => findJobRows(RecordUserGpuBids[JOB_NAME], { singletonKey: recordUserGpuBidsKeyFor(owner, dseq) })
    };
  }
});

const GPU_GROUP_SPEC = {
  name: "dcloud",
  requirements: { signed_by: { all_of: [], any_of: [] }, attributes: [] },
  resources: [
    {
      resource: {
        id: 1,
        cpu: { units: { val: "100" }, attributes: [] },
        memory: { quantity: { val: "268435456" }, attributes: [] },
        storage: [{ name: "default", quantity: { val: "268435456" }, attributes: [] }],
        gpu: { units: { val: "1" }, attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] },
        endpoints: []
      },
      count: 1,
      price: { denom: "uact", amount: "100000.000000000000000000" }
    }
  ]
};
