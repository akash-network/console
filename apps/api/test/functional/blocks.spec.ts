import type { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { addMinutes, addSeconds, getUnixTime, subSeconds } from "date-fns";
import { map } from "lodash";

import { app } from "@src/app";

import { BlockSeeder } from "@test/seeders/block.seeder";
import { ValidatorSeeder } from "@test/seeders/validator.seeder";

describe("Blocks", () => {
  const blockFrequency = 15;
  const testData: {
    blocks?: AkashBlock[];
  } = {};
  let isDbInitialized = false;

  const setup = async () => {
    if (isDbInitialized) {
      return testData;
    }

    const validator = await ValidatorSeeder.createInDatabase();

    const baseTime = new Date();
    testData.blocks = await Promise.all(
      Array.from({ length: 101 }, (_, i) => {
        return BlockSeeder.createInDatabase({
          height: i + 1,
          proposer: validator.hexAddress,
          datetime: subSeconds(baseTime, (101 - i) * blockFrequency)
        });
      })
    );
    isDbInitialized = true;

    return testData;
  };

  const expectBlocks = (blocksFound: AkashBlock[], blocksExpected: AkashBlock[]) => {
    expect(blocksFound.length).toBe(blocksExpected.length);

    const heightsFound = map(blocksFound, "height");
    blocksExpected.forEach(blockExpected => {
      expect(heightsFound).toContain(blockExpected.height);
    });
  };

  describe("GET /v1/blocks", () => {
    it("resolves 20 blocks by default", async () => {
      const { blocks } = await setup();

      const response = await app.request("/v1/blocks");
      const blocksFound = (await response.json()) as AkashBlock[];

      expect(response.status).toBe(200);
      expectBlocks(blocksFound, blocks.slice(81, 101).reverse());
    });

    it("resolves list of most recent blocks", async () => {
      const { blocks } = await setup();

      const response = await app.request("/v1/blocks?limit=2");
      const blocksFound = (await response.json()) as AkashBlock[];

      expect(response.status).toBe(200);
      expectBlocks(blocksFound, blocks.slice(99, 101).reverse());
    });

    it("will not resolve more than 100 blocks", async () => {
      await setup();

      const response = await app.request("/v1/blocks?limit=101", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/blocks/{height}", () => {
    it("resolves block by height", async () => {
      const { blocks } = await setup();

      const response = await app.request(`/v1/blocks/${blocks[0].height}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const blockFound = (await response.json()) as any;

      expect(response.status).toBe(200);
      expectBlocks([blocks[0]], [blockFound]);
    });

    it("responds 400 for invalid height", async () => {
      await setup();

      const response = await app.request("/v1/blocks/a", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });

    it("responds 404 for a block not found", async () => {
      await setup();

      const response = await app.request("/v1/blocks/0", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /predicted-date-height/{timestamp}", () => {
    const baseTime = new Date();
    [
      {
        timestamp: getUnixTime(addSeconds(baseTime, 2)),
        expectedHeight: 102
      },
      {
        timestamp: getUnixTime(addSeconds(baseTime, 20)),
        expectedHeight: 103
      },
      {
        timestamp: getUnixTime(addMinutes(baseTime, 30)),
        expectedHeight: 221
      }
    ].forEach(({ timestamp, expectedHeight }) => {
      it(`resolves estimated height for a point in future ${timestamp}`, async () => {
        await setup();

        const response = await app.request(`/v1/predicted-date-height/${timestamp}`);

        expect(response.status).toBe(200);
        const data = (await response.json()) as { predictedHeight: number };
        expect(data.predictedHeight).toBe(expectedHeight);
      });
    });

    it("responds 400 for a timestamp in the past", async () => {
      await setup();

      const response = await app.request("/v1/predicted-date-height/123");

      expect(response.status).toBe(400);
    });

    it("responds 400 for invalid timestamp", async () => {
      await setup();

      const response = await app.request("/v1/predicted-date-height/invalid-timestamp");

      expect(response.status).toBe(400);
    });

    it("responds 400 for an invalid block window", async () => {
      await setup();

      const response = await app.request("/v1/predicted-date-height/1717737600?blockWindow=invalid-block-window");

      expect(response.status).toBe(400);
    });

    it("responds 400 for a negative block window", async () => {
      await setup();

      const response = await app.request("/v1/predicted-date-height/1717737600?blockWindow=-1");

      expect(response.status).toBe(400);
    });
  });

  describe("GET /predicted-block-date/{height}", () => {
    const interval = (date: Date) => {
      return {
        from: getUnixTime(subSeconds(date, blockFrequency)),
        to: getUnixTime(addSeconds(date, blockFrequency))
      };
    };

    const baseTime = new Date();
    [
      {
        height: 102,
        expectedDate: interval(addSeconds(baseTime, 2))
      },
      {
        height: 103,
        expectedDate: interval(addSeconds(baseTime, 20))
      },
      {
        height: 221,
        expectedDate: interval(addMinutes(baseTime, 30))
      }
    ].forEach(({ height, expectedDate }) => {
      it(`resolves estimated date for a future height ${height}`, async () => {
        await setup();

        const response = await app.request(`/v1/predicted-block-date/${height}`);

        expect(response.status).toBe(200);
        const data = (await response.json()) as { predictedDate: string };
        const predictedUnixTime = getUnixTime(new Date(data.predictedDate));
        expect(predictedUnixTime).toBeGreaterThanOrEqual(expectedDate.from);
        expect(predictedUnixTime).toBeLessThanOrEqual(expectedDate.to);
      });
    });

    it("responds 400 for a height in the past", async () => {
      await setup();

      const response = await app.request("/v1/predicted-block-date/1");

      expect(response.status).toBe(400);
    });

    it("responds 400 for invalid height", async () => {
      await setup();

      const response = await app.request("/v1/predicted-block-date/invalid-height");

      expect(response.status).toBe(400);
    });

    it("responds 400 for an invalid block window", async () => {
      await setup();

      const response = await app.request("/v1/predicted-block-date/123?blockWindow=invalid-block-window");

      expect(response.status).toBe(400);
    });

    it("responds 400 for a negative block window", async () => {
      await setup();

      const response = await app.request("/v1/predicted-block-date/123?blockWindow=-1");

      expect(response.status).toBe(400);
    });
  });
});
