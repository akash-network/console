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

  async function setup() {
    const owner = createAkashAddress();
    const dseq = createDseq();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("GpuBidChecks");
    const { enqueue, startWorkers } = await jobWorkers();

    function answerBidsWith(bids: Array<{ gseq: number; provider: string }>) {
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .get("/akash/market/v1beta5/bids/list")
        .query(query => query["filters.owner"] === owner && query["filters.dseq"] === dseq)
        .reply(200, {
          bids: bids.map(({ gseq, provider }) => ({
            bid: {
              id: { owner, dseq, gseq, oseq: 1, provider, bseq: 0 },
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
      enqueue: (data: RecordUserGpuBids["data"]) => enqueue(new RecordUserGpuBids(data), { singletonKey: recordUserGpuBidsKeyFor(owner, dseq) }),
      findChecks: () => db.select().from(table).where(eq(table.dseq, dseq))
    };
  }
});
