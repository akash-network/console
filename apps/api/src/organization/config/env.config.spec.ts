import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("defaults to 3 teams per user and 10 projects per organization", () => {
    expect(envSchema.parse({})).toEqual({
      TEAM_ORGANIZATIONS_PER_USER_LIMIT: 3,
      PROJECTS_PER_ORGANIZATION_LIMIT: 10
    });
  });

  it("reads both limits from the environment", () => {
    expect(envSchema.parse({ TEAM_ORGANIZATIONS_PER_USER_LIMIT: "5", PROJECTS_PER_ORGANIZATION_LIMIT: "25" })).toEqual({
      TEAM_ORGANIZATIONS_PER_USER_LIMIT: 5,
      PROJECTS_PER_ORGANIZATION_LIMIT: 25
    });
  });

  it("refuses a limit below 1", () => {
    expect(() => envSchema.parse({ TEAM_ORGANIZATIONS_PER_USER_LIMIT: "0" })).toThrow();
    expect(() => envSchema.parse({ PROJECTS_PER_ORGANIZATION_LIMIT: "0" })).toThrow();
  });
});
