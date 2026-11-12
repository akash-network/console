import { container } from "tsyringe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app, initDb } from "@src/rest-app";

import { createAkashBlock, createSinkTransfer } from "@test/seeders";

describe("Sink transfers", () => {
  const createdAt = new Date("2026-11-11T10:00:00Z");
  const mintedAt = new Date("2026-11-11T10:03:00Z");

  beforeAll(async () => {
    await initDb();

    await createAkashBlock({ height: 100, datetime: createdAt, isProcessed: true });
    await createAkashBlock({ height: 130, datetime: mintedAt, isProcessed: true });
    await createSinkTransfer({
      height: 100,
      sequence: 1,
      owner: "akash1largest",
      recipient: "solanaLargest",
      amount: "975031000000",
      status: "minted",
      statusHeight: 130
    });
    await createSinkTransfer({ height: 100, sequence: 2, owner: "akash1small", recipient: "solanaSmall", amount: "5000000" });
    await createSinkTransfer({ height: 130, sequence: 1, owner: "akash1latest", recipient: "solanaLatest", amount: "7000000" });
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/sink/transfers", () => {
    it("returns the most recent transfers first by default", async () => {
      const response = await app.request("/v1/sink/transfers");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        count: 3,
        results: [
          {
            owner: "akash1latest",
            height: 130,
            sequence: 1,
            recipient: "solanaLatest",
            amountUakt: 7000000,
            status: "pending",
            createdAt: mintedAt.toISOString(),
            statusHeight: 130,
            statusUpdatedAt: mintedAt.toISOString()
          },
          {
            owner: "akash1small",
            height: 100,
            sequence: 2,
            recipient: "solanaSmall",
            amountUakt: 5000000,
            status: "pending",
            createdAt: createdAt.toISOString(),
            statusHeight: 100,
            statusUpdatedAt: createdAt.toISOString()
          },
          {
            owner: "akash1largest",
            height: 100,
            sequence: 1,
            recipient: "solanaLargest",
            amountUakt: 975031000000,
            status: "minted",
            createdAt: createdAt.toISOString(),
            statusHeight: 130,
            statusUpdatedAt: mintedAt.toISOString()
          }
        ]
      });
    });

    it("returns the requested page of the largest transfers", async () => {
      const response = await app.request("/v1/sink/transfers?sort=largest&skip=1&limit=1");
      const body = (await response.json()) as { count: number; results: { owner: string }[] };

      expect(response.status).toBe(200);
      expect(body.count).toBe(3);
      expect(body.results.map(transfer => transfer.owner)).toEqual(["akash1latest"]);
    });

    it.each(["limit=101", "skip=-1", "sort=oldest"])("responds with 400 for %s", async query => {
      const response = await app.request(`/v1/sink/transfers?${query}`);

      expect(response.status).toBe(400);
    });
  });
});
