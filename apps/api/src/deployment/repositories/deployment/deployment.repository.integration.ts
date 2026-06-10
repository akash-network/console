import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CHAIN_DB } from "@src/chain";
import { DeploymentRepository } from "./deployment.repository";

import { createAkashBlock, createAkashMessage, createDeployment, createDeploymentGroup, createDeploymentGroupResource, createTransaction } from "@test/seeders";

const BID_TYPE = "/akash.market.v1beta5.MsgCreateBid";

describe(DeploymentRepository.name, () => {
  describe("findAllWithGpuResources", () => {
    it("yields a single-GPU deployment with its bid message", async () => {
      const { repository, base } = setup();
      await createAkashBlock({ height: base });
      const deployment = await seedGpuDeployment({ createdHeight: base, bidHeight: base });

      const yielded = await collect(repository.findAllWithGpuResources({ minHeight: base }));

      const mine = yielded.filter(d => d.id === deployment.id);
      expect(mine).toHaveLength(1);
      expect(mine[0].relatedMessages).toHaveLength(1);
      expect(mine[0].relatedMessages[0].type).toBe(BID_TYPE);
    });

    it("excludes deployments without a gpuUnits=1 resource", async () => {
      const { repository, base } = setup();
      await createAkashBlock({ height: base });
      const gpuDeployment = await seedGpuDeployment({ createdHeight: base, bidHeight: base });
      const nonGpuDeployment = await seedGpuDeployment({ createdHeight: base, bidHeight: base, gpuUnits: 2 });

      const yielded = await collect(repository.findAllWithGpuResources({ minHeight: base }));

      const ids = yielded.map(d => d.id);
      expect(ids).toContain(gpuDeployment.id);
      expect(ids).not.toContain(nonGpuDeployment.id);
    });

    it("excludes deployments created before minHeight even when they have a qualifying bid", async () => {
      const { repository, base } = setup();
      await createAkashBlock({ height: base });
      const tooOld = await seedGpuDeployment({ createdHeight: base - 1, bidHeight: base });

      const yielded = await collect(repository.findAllWithGpuResources({ minHeight: base }));

      expect(yielded.map(d => d.id)).not.toContain(tooOld.id);
    });

    it("counts a deployment with multiple gpuUnits=1 resources once (EXISTS, not a fanning JOIN)", async () => {
      const { repository, base } = setup();
      await createAkashBlock({ height: base });
      // Two separate groups, each with a gpuUnits=1 resource: a JOIN deployment->group->resource
      // would emit two rows for this deployment and double-count its single bid.
      const deployment = await seedGpuDeployment({ createdHeight: base, bidHeight: base, groupCount: 2, bidCount: 1 });

      const yielded = await collect(repository.findAllWithGpuResources({ minHeight: base }));

      const mine = yielded.filter(d => d.id === deployment.id);
      expect(mine).toHaveLength(1);
      expect(mine[0].relatedMessages).toHaveLength(1);
    });

    it("yields every deployment exactly once across a chunk boundary", async () => {
      const { repository, base, band } = setup();
      await createAkashBlock({ height: base });
      // Equal createdHeight forces the (createdHeight, id) tiebreaker to do the paging.
      const d1 = await seedGpuDeployment({ id: orderedId(band, 1), createdHeight: base, bidHeight: base });
      const d2 = await seedGpuDeployment({ id: orderedId(band, 2), createdHeight: base, bidHeight: base });
      const d3 = await seedGpuDeployment({ id: orderedId(band, 3), createdHeight: base, bidHeight: base });

      const yielded = await collect(repository.findAllWithGpuResources({ minHeight: base, chunkSize: 2 }));

      const mine = yielded.filter(d => [d1.id, d2.id, d3.id].includes(d.id)).map(d => d.id);
      expect(mine).toEqual([d1.id, d2.id, d3.id]);
    });

    it("rejects a non-positive chunkSize", async () => {
      const { repository, base } = setup();

      await expect(collect(repository.findAllWithGpuResources({ minHeight: base, chunkSize: 0 }))).rejects.toThrow("positive integer");
    });

    it("does not skip later deployments when a chunk contains a GPU deployment with no qualifying bid", async () => {
      const { repository, base, band } = setup();
      await createAkashBlock({ height: base });
      // D2 is a GPU deployment with no bid. With chunkSize=2 it shares the first window with D1.
      // The bid load must not shorten the chunk and end paging early — every GPU deployment is
      // still yielded once, in keyset order, with only the bid-bearing ones carrying a message.
      const d1 = await seedGpuDeployment({ id: orderedId(band, 1), createdHeight: base, bidHeight: base });
      const d2 = await seedGpuDeployment({ id: orderedId(band, 2), createdHeight: base, bidHeight: base, bidCount: 0 });
      const d3 = await seedGpuDeployment({ id: orderedId(band, 3), createdHeight: base, bidHeight: base });
      const d4 = await seedGpuDeployment({ id: orderedId(band, 4), createdHeight: base, bidHeight: base });

      const yielded = await collect(repository.findAllWithGpuResources({ minHeight: base, chunkSize: 2 }));

      const mine = yielded.filter(d => [d1.id, d2.id, d3.id, d4.id].includes(d.id));
      expect(mine.map(d => d.id)).toEqual([d1.id, d2.id, d3.id, d4.id]);
      expect(mine.map(d => d.relatedMessages.length)).toEqual([1, 0, 1, 1]);
    });
  });

  let testBand = 0;

  function setup() {
    // Resolve CHAIN_DB so the chain Sequelize instance (and its models) is initialized — the
    // repository uses the static models directly and does not inject the connection itself.
    container.resolve(CHAIN_DB);
    const repository = container.resolve(DeploymentRepository);
    testBand += 1;
    // Each test owns a disjoint, ascending height band so its query (minHeight = base) sees only
    // its own deployments: lower bands are filtered out, higher bands are seeded by later tests.
    const base = 1_000_000 + testBand * 10_000;
    return { repository, base, band: testBand };
  }

  async function collect<T>(generator: AsyncGenerator<T>) {
    const out: T[] = [];
    for await (const item of generator) out.push(item);
    return out;
  }

  // Deterministically ordered UUID: same band keeps the prefix fixed (so ids sort by seq within a
  // test), distinct bands keep ids unique across tests in the shared per-file database.
  function orderedId(band: number, seq: number) {
    return `${band.toString(16).padStart(8, "0")}-0000-4000-8000-${seq.toString(16).padStart(12, "0")}`;
  }

  async function seedGpuDeployment(input: {
    createdHeight: number;
    bidHeight: number;
    id?: string;
    owner?: string;
    groupCount?: number;
    gpuUnits?: number;
    bidCount?: number;
  }) {
    const owner = input.owner ?? faker.string.alphanumeric(44);
    const deployment = await createDeployment({ id: input.id, owner, createdHeight: input.createdHeight, dseq: faker.string.numeric(12) });

    for (let i = 0; i < (input.groupCount ?? 1); i++) {
      const group = await createDeploymentGroup({ deploymentId: deployment.id, owner });
      await createDeploymentGroupResource({ deploymentGroupId: group.id, gpuUnits: input.gpuUnits ?? 1 });
    }

    for (let i = 0; i < (input.bidCount ?? 1); i++) {
      const transaction = await createTransaction({ height: input.bidHeight });
      await createAkashMessage({ type: BID_TYPE, txId: transaction.id, height: input.bidHeight, relatedDeploymentId: deployment.id });
    }

    return deployment;
  }
});
