import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { providerIncidents } from "@src/model-schemas/provider-incident/provider-incident.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { ProviderIncidentRepository } from "./provider-incident.repository";

const SECONDS_PER_DAY = 24 * 60 * 60;

describe(ProviderIncidentRepository.name, () => {
  describe("openIncident", () => {
    it("inserts an open row when no prior incident exists for the provider", async () => {
      const { repository, db } = setup();

      await repository.openIncident("akash1a");

      const rows = await db.select().from(providerIncidents);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ provider: "akash1a", endedAt: null });
      expect(rows[0].startedAt).toBeInstanceOf(Date);
    });

    it("is idempotent while an incident is already open", async () => {
      const { repository, db } = setup();

      await repository.openIncident("akash1a");
      const [firstRow] = await db.select().from(providerIncidents);

      await repository.openIncident("akash1a");

      const rows = await db.select().from(providerIncidents);
      expect(rows).toHaveLength(1);
      expect(rows[0].endedAt).toBeNull();
      expect(rows[0].startedAt.toISOString()).toBe(firstRow.startedAt.toISOString());
    });

    it("opens a new incident for a fresh outage and leaves the prior closed incident intact", async () => {
      const { repository, db } = setup();
      await seedClosed(db, { provider: "akash1a", startedAt: new Date("2026-01-01T00:00:00Z"), endedAt: new Date("2026-01-01T00:05:00Z") });

      await repository.openIncident("akash1a");

      const rows = await db.select().from(providerIncidents).where(eq(providerIncidents.provider, "akash1a"));
      expect(rows).toHaveLength(2);

      const open = rows.filter(r => r.endedAt === null);
      const closed = rows.filter(r => r.endedAt !== null);
      expect(open).toHaveLength(1);
      expect(closed).toHaveLength(1);
      expect(closed[0].startedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(closed[0].endedAt?.toISOString()).toBe("2026-01-01T00:05:00.000Z");
      expect(open[0].startedAt.getTime()).toBeGreaterThan(closed[0].startedAt.getTime());
    });
  });

  describe("closeIncident", () => {
    it("closes the open row for the given provider", async () => {
      const { repository, db } = setup();
      await repository.openIncident("akash1a");
      await repository.openIncident("akash1b");

      await repository.closeIncident("akash1a");

      const rows = await db.select().from(providerIncidents);
      const byProvider = Object.fromEntries(rows.map(r => [r.provider, r.endedAt]));
      expect(byProvider["akash1a"]).toBeInstanceOf(Date);
      expect(byProvider["akash1b"]).toBeNull();
    });

    it("is a no-op when no incident is open for the provider", async () => {
      const { repository, db } = setup();
      await seedClosed(db, { provider: "akash1a", endedAt: new Date("2026-01-01T00:05:00Z") });

      await repository.closeIncident("akash1a");

      const [row] = await db.select().from(providerIncidents).where(eq(providerIncidents.provider, "akash1a"));
      expect(row.endedAt?.toISOString()).toBe("2026-01-01T00:05:00.000Z");
    });

    it("closes every open row matching the given owners in a single statement when called with an array", async () => {
      const { repository, db } = setup();
      await repository.openIncident("akash1a");
      await repository.openIncident("akash1b");
      await repository.openIncident("akash1c");

      await repository.closeIncident(["akash1a", "akash1c"]);

      const rows = await db.select().from(providerIncidents);
      const byProvider = Object.fromEntries(rows.map(r => [r.provider, r.endedAt]));
      expect(byProvider["akash1a"]).toBeInstanceOf(Date);
      expect(byProvider["akash1b"]).toBeNull();
      expect(byProvider["akash1c"]).toBeInstanceOf(Date);
    });

    it("does nothing when called with an empty array", async () => {
      const { repository, db } = setup();
      await repository.openIncident("akash1a");

      await repository.closeIncident([]);

      const [row] = await db.select().from(providerIncidents).where(eq(providerIncidents.provider, "akash1a"));
      expect(row.endedAt).toBeNull();
    });
  });

  describe("closeAllOpen", () => {
    it("closes every open row and leaves already-closed rows untouched", async () => {
      const { repository, db } = setup();
      await repository.openIncident("akash1a");
      await repository.openIncident("akash1b");
      await seedClosed(db, { provider: "akash1c", endedAt: new Date("2026-01-01T00:05:00Z") });

      await repository.closeAllOpen();

      const rows = await db.select().from(providerIncidents);
      const byProvider = Object.fromEntries(rows.map(r => [r.provider, r.endedAt]));
      expect(byProvider["akash1a"]).toBeInstanceOf(Date);
      expect(byProvider["akash1b"]).toBeInstanceOf(Date);
      expect(byProvider["akash1c"]?.toISOString()).toBe("2026-01-01T00:05:00.000Z");
    });
  });

  describe("deleteEndedBefore", () => {
    it("deletes incidents that ended before the retention window and reports the deleted count", async () => {
      const { repository, db } = setup();
      await seedClosed(db, { provider: "akash1a", endedAt: atDaysAgoUtc(40, 10) });
      await seedClosed(db, { provider: "akash1b", endedAt: atDaysAgoUtc(35, 10) });

      const deletedCount = await repository.deleteEndedBefore(31);

      expect(deletedCount).toBe(2);
      const rows = await db.select().from(providerIncidents);
      expect(rows).toHaveLength(0);
    });

    it("keeps incidents that ended within the retention window", async () => {
      const { repository, db } = setup();
      await seedClosed(db, { provider: "akash1a", endedAt: atDaysAgoUtc(10, 10) });

      const deletedCount = await repository.deleteEndedBefore(31);

      expect(deletedCount).toBe(0);
      const rows = await db.select().from(providerIncidents);
      expect(rows).toHaveLength(1);
      expect(rows[0].provider).toBe("akash1a");
    });

    it("never deletes still-open incidents regardless of how long ago they started", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: atDaysAgoUtc(90, 10), endedAt: null });

      const deletedCount = await repository.deleteEndedBefore(31);

      expect(deletedCount).toBe(0);
      const [row] = await db.select().from(providerIncidents);
      expect(row).toMatchObject({ provider: "akash1a", endedAt: null });
    });
  });

  describe("findDailyDowntimeByProviders", () => {
    it("returns an empty array when called with no providers", async () => {
      const { repository } = setup();

      const rows = await repository.findDailyDowntimeByProviders([]);

      expect(rows).toEqual([]);
    });

    it("reports a single closed within-day incident as one row with its exact duration", async () => {
      const { repository, db } = setup();
      const startedAt = atDaysAgoUtc(2, 10);
      const endedAt = atDaysAgoUtc(2, 10, 5);
      await seedIncident(db, { provider: "akash1a", startedAt, endedAt });

      const rows = await repository.findDailyDowntimeByProviders(["akash1a"]);

      expect(rows).toEqual([
        {
          provider: "akash1a",
          date: utcDate(startedAt),
          hasOpenIncident: false,
          incidentCount: 1,
          downtimeSeconds: 5 * 60
        }
      ]);
    });

    it("flags every row of a provider with a currently-open incident", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: atDaysAgoUtc(2, 10), endedAt: null });

      const rows = await repository.findDailyDowntimeByProviders(["akash1a"]);

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(r => r.hasOpenIncident)).toBe(true);
    });

    it("treats the open flag as provider-wide when a closed and an open incident coexist", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: atDaysAgoUtc(4, 10), endedAt: atDaysAgoUtc(4, 10, 5) });
      await seedIncident(db, { provider: "akash1a", startedAt: atDaysAgoUtc(2, 10), endedAt: null });

      const rows = await repository.findDailyDowntimeByProviders(["akash1a"]);

      expect(rows.every(r => r.hasOpenIncident)).toBe(true);
    });

    it("clips an incident crossing UTC midnight into one row per day", async () => {
      const { repository, db } = setup();
      const startedAt = atDaysAgoUtc(2, 23);
      const endedAt = atDaysAgoUtc(1, 1);
      await seedIncident(db, { provider: "akash1a", startedAt, endedAt });

      const rows = await repository.findDailyDowntimeByProviders(["akash1a"]);

      expect(rows.map(r => r.date)).toEqual([utcDate(startedAt), utcDate(endedAt)]);
      expect(rows.map(r => r.downtimeSeconds)).toEqual([60 * 60, 60 * 60]);
      expect(rows.reduce((sum, r) => sum + r.downtimeSeconds, 0)).toBe(2 * 60 * 60);
    });

    it("groups and filters by provider across a batched call, ordered by provider then date", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1b", startedAt: atDaysAgoUtc(3, 10), endedAt: atDaysAgoUtc(3, 10, 5) });
      await seedIncident(db, { provider: "akash1a", startedAt: atDaysAgoUtc(2, 10), endedAt: atDaysAgoUtc(2, 10, 5) });
      await seedIncident(db, { provider: "akash1c", startedAt: atDaysAgoUtc(2, 10), endedAt: atDaysAgoUtc(2, 10, 5) });

      const rows = await repository.findDailyDowntimeByProviders(["akash1a", "akash1b"]);

      expect(rows.map(r => r.provider)).toEqual(["akash1a", "akash1b"]);
      expect([...rows].sort(byProviderThenDate)).toEqual(rows);
    });
  });

  function setup() {
    const repository = container.resolve(ProviderIncidentRepository);
    const db = container.resolve<PostgresJsDatabase>(DRIZZLE_DB);
    return { repository, db };
  }
});

function byProviderThenDate(a: { provider: string; date: string }, b: { provider: string; date: string }): number {
  return a.provider === b.provider ? a.date.localeCompare(b.date) : a.provider.localeCompare(b.provider);
}

// A timestamp `daysAgo` whole UTC days back, pinned to a fixed UTC wall-clock time so single-day
// intervals stay comfortably away from midnight and land on a deterministic calendar day.
function atDaysAgoUtc(daysAgo: number, hour: number, minute = 0): Date {
  const date = new Date(Date.now() - daysAgo * SECONDS_PER_DAY * 1000);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface SeedClosedInput {
  provider: string;
  startedAt?: Date;
  endedAt: Date;
}

async function seedClosed(db: PostgresJsDatabase, input: SeedClosedInput): Promise<void> {
  await db.insert(providerIncidents).values({
    provider: input.provider,
    startedAt: input.startedAt ?? new Date(input.endedAt.getTime() - 60_000),
    endedAt: input.endedAt
  });
}

async function seedIncident(db: PostgresJsDatabase, input: { provider: string; startedAt: Date; endedAt: Date | null }): Promise<void> {
  await db.insert(providerIncidents).values({ provider: input.provider, startedAt: input.startedAt, endedAt: input.endedAt });
}
