import { container } from "tsyringe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SinkUnbondingsResponse } from "@src/dashboard/http-schemas/sink-unbondings/sink-unbondings.schema";
import { app, initDb } from "@src/rest-app";

import { createAkashBlock, createSinkTransfer, createStakingUnbonding } from "@test/seeders";

describe("Sink unbondings", () => {
  beforeAll(async () => {
    await initDb();

    await createAkashBlock({ height: 100, datetime: new Date("2026-11-10T10:00:00Z"), isProcessed: true });
    await createAkashBlock({ height: 200, datetime: new Date("2026-11-12T10:00:00Z"), isProcessed: true });
    await createStakingUnbonding({
      height: 100,
      delegator: "akash1migrating",
      validator: "akashvaloper1validator",
      amount: "300000000",
      completionTime: new Date("2026-12-01T10:00:00Z")
    });
    await createSinkTransfer({ height: 200, sequence: 1, owner: "akash1migrating", amount: "100000000", status: "minted" });
    await createSinkTransfer({ height: 200, sequence: 2, owner: "akash1liquid", amount: "50000000", status: "pending" });
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/sink/unbondings", () => {
    it("returns the unbondings alongside the AKT sent to Solana", async () => {
      const response = await app.request("/v1/sink/unbondings");

      expect(response.status).toBe(200);
      const body = (await response.json()) as SinkUnbondingsResponse;
      expect(body.summary).toEqual({
        unbondingUakt: 300000000,
        unbondingDelegators: 1,
        senders: 2,
        sendersWhoUnbonded: 1,
        sentUakt: 150000000,
        sentBySendersWhoUnbondedUakt: 100000000
      });
      expect(body.daily).toHaveLength(22);
      expect(body.daily[0]).toEqual({
        date: "2026-11-10",
        unbondStartedUakt: 300000000,
        unbondCompletingUakt: 0,
        cancelledUakt: 0,
        sentToSolanaUakt: 0,
        sentBySendersWhoUnbondedUakt: 0
      });
      expect(body.daily[2]).toEqual({
        date: "2026-11-12",
        unbondStartedUakt: 0,
        unbondCompletingUakt: 0,
        cancelledUakt: 0,
        sentToSolanaUakt: 150000000,
        sentBySendersWhoUnbondedUakt: 100000000
      });
      expect(body.daily[21]).toEqual({
        date: "2026-12-01",
        unbondStartedUakt: 0,
        unbondCompletingUakt: 300000000,
        cancelledUakt: 0,
        sentToSolanaUakt: 0,
        sentBySendersWhoUnbondedUakt: 0
      });
    });
  });
});
