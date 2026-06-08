import "@src/providers";

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

  function setup() {
    const repository = container.resolve(ProviderIncidentRepository);
    const db = container.resolve<PostgresJsDatabase>(DRIZZLE_DB);
    return { repository, db };
  }
});

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
