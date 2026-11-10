import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { RecordUserGpuBids, RecordUserGpuBidsHandler, recordUserGpuBidsKeyFor } from "./record-user-gpu-bids.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(RecordUserGpuBidsHandler)]);

describe(RecordUserGpuBidsHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("records which screened providers bid on a user's gpu deployment, run the way a worker runs it", async () => {
    const { owner, dseq, enqueue, startWorkers, findChecks, answerBidsWith } = await setup();
    const [bidder, silent] = [createAkashAddress(), createAkashAddress()];
    answerBidsWith([{ gseq: 1, provider: bidder }]);

    await enqueue({ owner, dseq, groups: [{ gseq: 1, vendor: "nvidia", model: "h100", screened: [bidder, silent], wasOpenThroughWait: true }] });
    await startWorkers();

    await expectJobCompleted(RecordUserGpuBids[JOB_NAME], { singletonKey: recordUserGpuBidsKeyFor(owner, dseq) });
    expect(await findChecks()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: bidder, vendor: "nvidia", model: "h100", source: "user-deployment", screened: true, bid: true }),
        expect.objectContaining({ provider: silent, vendor: "nvidia", model: "h100", source: "user-deployment", screened: true, bid: false })
      ])
    );
    expect(await findChecks()).toHaveLength(2);
  });

  it("records one anonymous zero bid for a gpu group nobody bid on, however many of the owner's deployments ask the same", async () => {
    const { owner, enqueue, startWorkers, answerBidsWith, findUnmetDemand } = await setup();
    const model = `h100-${faker.string.alphanumeric(8)}`;
    const [firstDseq, secondDseq] = [createDseq(), createDseq()];
    answerBidsWith([], firstDseq);
    answerBidsWith([], secondDseq);
    const group = { gseq: 1, vendor: "nvidia", model, gpuCount: 8, regionArea: "eu" as const, screened: [createAkashAddress()], wasOpenThroughWait: true };

    await enqueue({ owner, dseq: firstDseq, groups: [group] });
    await enqueue({ owner, dseq: secondDseq, groups: [group] });
    await startWorkers();

    await expectJobCompleted(RecordUserGpuBids[JOB_NAME], { singletonKey: recordUserGpuBidsKeyFor(owner, firstDseq) });
    await expectJobCompleted(RecordUserGpuBids[JOB_NAME], { singletonKey: recordUserGpuBidsKeyFor(owner, secondDseq) });
    expect(await findUnmetDemand(model)).toEqual([
      {
        id: expect.any(String),
        kind: "zero_bid",
        vendor: "nvidia",
        model,
        gpuCount: 8,
        regionArea: "eu",
        dedupeKey: expect.any(String),
        occurredAt: expect.any(Date)
      }
    ]);
  });

  async function setup() {
    const owner = createAkashAddress();
    const dseq = createDseq();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("GpuBidChecks");
    const unmetDemandTable = resolveTable("UnmetDemandEvents");
    const { enqueue, startWorkers } = await jobWorkers();

    function answerBidsWith(bids: Array<{ gseq: number; provider: string }>, bidsDseq = dseq) {
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .get("/akash/market/v1beta5/bids/list")
        .query(query => query["filters.owner"] === owner && query["filters.dseq"] === bidsDseq)
        .reply(200, {
          bids: bids.map(({ gseq, provider }) => ({
            bid: {
              id: { owner, dseq: bidsDseq, gseq, oseq: 1, provider, bseq: 0 },
              state: "closed",
              price: { denom: "uact", amount: "1000.000000000000000000" },
              created_at: "28343549",
              resources_offer: []
            },
            escrow_account: null
          })),
          pagination: { next_key: null, total: String(bids.length) }
        });
    }

    return {
      owner,
      dseq,
      answerBidsWith,
      startWorkers,
      enqueue: (data: RecordUserGpuBids["data"]) => enqueue(new RecordUserGpuBids(data), { singletonKey: recordUserGpuBidsKeyFor(data.owner, data.dseq) }),
      findChecks: () => db.select().from(table).where(eq(table.dseq, dseq)),
      findUnmetDemand: (model: string) => db.select().from(unmetDemandTable).where(eq(unmetDemandTable.model, model))
    };
  }
});
