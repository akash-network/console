import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppConfigService } from "@src/services/app-config/app-config.service";
import { FundingControlsDatabase } from "./funding-controls-database.provider";

describe(FundingControlsDatabase.name, () => {
  it("is not configured for a signer given no database, and says which setting is missing when read anyway", () => {
    const { database } = setup({ url: undefined });

    expect(database.isConfigured).toBe(false);
    expect(() => database.orm).toThrow("FUNDING_CONTROLS_POSTGRES_URL is not set, so this signer has no funding controls to read");
  });

  it("closes nothing for a signer given no database", async () => {
    const { database } = setup({ url: undefined });

    await expect(database.dispose()).resolves.toBeUndefined();
  });

  it("is configured for a signer given a database, without connecting until something is read", async () => {
    const { database } = setup({ url: "postgres://signer@unreachable.invalid:5432/signer_controls" });

    expect(database.isConfigured).toBe(true);
    expect(database.orm).toBe(database.orm);
    await expect(database.dispose()).resolves.toBeUndefined();
  });

  function setup(input: { url: string | undefined }) {
    const config = mock<AppConfigService>();
    config.get.mockImplementation(((key: string) => {
      const values: Record<string, unknown> = { FUNDING_CONTROLS_POSTGRES_URL: input.url, FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS: 2 };

      return values[key];
    }) as AppConfigService["get"]);

    return { database: new FundingControlsDatabase(config) };
  }
});
