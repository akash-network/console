import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { app } from "@src/rest-app";

const secretToken = container.resolve(CORE_CONFIG).SECRET_TOKEN;

describe("GET /dashboard/stats", () => {
  it("rejects a caller without the private token", async () => {
    const response = await app.request("/dashboard/stats");

    expect(response.status).toBe(401);
  });

  it("rejects a caller with the wrong private token", async () => {
    const response = await app.request(`/dashboard/stats?token=${faker.string.alphanumeric(32)}`);

    expect(response.status).toBe(401);
  });

  it("reports user and template counts to a caller with the private token", async () => {
    const response = await app.request(`/dashboard/stats?token=${secretToken}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userCount: expect.any(Number),
      publicTemplateCount: expect.any(Number),
      privateTemplateCount: expect.any(Number),
      totalTemplateCount: expect.any(Number)
    });
  });
});

describe("GET /internal/financial", () => {
  it("rejects a caller without the private token", async () => {
    const response = await app.request("/internal/financial");

    expect(response.status).toBe(401);
  });

  it("rejects a caller with the wrong private token", async () => {
    const response = await app.request(`/internal/financial?token=${faker.string.alphanumeric(32)}`);

    expect(response.status).toBe(401);
  });
});
