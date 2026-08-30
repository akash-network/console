import { describe, expect, it } from "vitest";

import { app } from "@src/rest-app";

describe("GET /v1/deployment-funding-config", () => {
  it("returns the funding constants without requiring auth", async () => {
    const response = await app.request("/v1/deployment-funding-config");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        targetRunwayHours: 48,
        balanceHeadroomUsd: 5,
        defaultDepositUsd: 0.5
      }
    });
  });

  it("marks the response as cacheable", async () => {
    const response = await app.request("/v1/deployment-funding-config");

    expect(response.headers.get("cache-control")).toContain("max-age=300");
  });
});
