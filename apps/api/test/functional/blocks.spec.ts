import { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { Validator } from "@akashnetwork/database/dbSchemas/base";
import { map } from "lodash";

import { app } from "@src/app";

import { BlockSeeder } from "@test/seeders/block.seeder";
import { ValidatorSeeder } from "@test/seeders/validator.seeder";

describe("Blocks", () => {
  let blocks: AkashBlock[];

  beforeAll(async () => {
    const validatorSeed = ValidatorSeeder.create();
    const validator = await Validator.create(validatorSeed);

    const blockSeeds = Array.from({ length: 101 }, (_, i) =>
      BlockSeeder.create({
        height: i + 1,
        proposer: validator.hexAddress
      })
    );

    blocks = await Promise.all(blockSeeds.map(async block => AkashBlock.create(block)));
  });

  const expectBlocks = (blocksFound: AkashBlock[], blocksExpected: AkashBlock[]) => {
    expect(blocksFound.length).toBe(blocksExpected.length);

    const heightsFound = map(blocksFound, "height");
    blocksExpected.forEach(blockExpected => {
      expect(heightsFound).toContain(blockExpected.height);
    });
  };

  describe("GET /v1/blocks", () => {
    it("resolves list of most recent blocks", async () => {
      const response = await app.request("/v1/blocks?limit=2", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const blocksFound = (await response.json()) as any;

      expect(response.status).toBe(200);
      expectBlocks(blocksFound, [blocks[100], blocks[99]]);
    });

    it("will not resolve more than 100 blocks", async () => {
      const response = await app.request("/v1/blocks?limit=101", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/blocks/{height}", () => {
    it("resolves block by height", async () => {
      const response = await app.request(`/v1/blocks/${blocks[0].height}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const blockFound = (await response.json()) as any;

      expect(response.status).toBe(200);
      expectBlocks([blocks[0]], [blockFound]);
    });

    it("responds 400 for invalid height", async () => {
      const response = await app.request("/v1/blocks/a", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });

    it("responds 404 for a block not found", async () => {
      const response = await app.request("/v1/blocks/0", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(404);
    });
  });
});
