import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { providerIncidents } from "@src/model-schemas/provider-incident/provider-incident.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import { ProviderIncidentRepository } from "./provider-incident.repository";

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

  describe("findRecentByProviders", () => {
    it("returns an empty array when called with no owners", async () => {
      const { repository } = setup();

      const rows = await repository.findRecentByProviders([]);

      expect(rows).toEqual([]);
    });

    it("returns a closed incident inside the window", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: daysAgo(2), endedAt: daysAgo(1) });

      const rows = await repository.findRecentByProviders(["akash1a"]);

      expect(rows).toHaveLength(1);
      expect(rows[0].provider).toBe("akash1a");
      expect(rows[0].startedAt).toMatch(ISO_MS);
      expect(rows[0].endedAt).toMatch(ISO_MS);
    });

    it("returns an ongoing incident with endedAt null", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: daysAgo(3), endedAt: null });

      const rows = await repository.findRecentByProviders(["akash1a"]);

      expect(rows).toHaveLength(1);
      expect(rows[0].endedAt).toBeNull();
    });

    it("includes an incident at the inner edge of the window and excludes one beyond it", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1in", startedAt: daysAgo(7.6), endedAt: daysAgo(7.5) });
      await seedIncident(db, { provider: "akash1out", startedAt: daysAgo(9.1), endedAt: daysAgo(9) });

      const rows = await repository.findRecentByProviders(["akash1in", "akash1out"]);

      expect(rows.map(r => r.provider)).toEqual(["akash1in"]);
    });

    it("orders multiple incidents for one provider by startedAt ascending", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: daysAgo(1), endedAt: daysAgo(0.5) });
      await seedIncident(db, { provider: "akash1a", startedAt: daysAgo(5), endedAt: daysAgo(4) });
      await seedIncident(db, { provider: "akash1a", startedAt: daysAgo(3), endedAt: daysAgo(2) });

      const rows = await repository.findRecentByProviders(["akash1a"]);

      expect(rows).toHaveLength(3);
      const startedAts = rows.map(r => r.startedAt);
      expect(startedAts).toEqual([...startedAts].sort());
    });

    it("returns only the real incident for a recently enrolled provider without fabricating pre-enrollment rows", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: daysAgo(2), endedAt: daysAgo(1) });

      const rows = await repository.findRecentByProviders(["akash1a"]);

      expect(rows).toHaveLength(1);
    });

    it("groups and filters incidents by provider across a batched call", async () => {
      const { repository, db } = setup();
      await seedIncident(db, { provider: "akash1a", startedAt: daysAgo(2), endedAt: daysAgo(1) });
      await seedIncident(db, { provider: "akash1b", startedAt: daysAgo(3), endedAt: null });
      await seedIncident(db, { provider: "akash1c", startedAt: daysAgo(1), endedAt: daysAgo(0.5) });

      const rows = await repository.findRecentByProviders(["akash1a", "akash1b"]);

      const byProvider = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.provider]: (acc[r.provider] ?? 0) + 1 }), {});
      expect(byProvider).toEqual({ akash1a: 1, akash1b: 1 });
    });
  });

  function setup() {
    const repository = container.resolve(ProviderIncidentRepository);
    const db = container.resolve<PostgresJsDatabase>(DRIZZLE_DB);
    return { repository, db };
  }
});

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function seedIncident(db: PostgresJsDatabase, input: { provider: string; startedAt: Date; endedAt: Date | null }): Promise<void> {
  await db.insert(providerIncidents).values({ provider: input.provider, startedAt: input.startedAt, endedAt: input.endedAt });
}
