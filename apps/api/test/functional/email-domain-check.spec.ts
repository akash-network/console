import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { app } from "@src/rest-app";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";

const PATH = "/internal/auth/email-domain-check";

describe("POST /internal/auth/email-domain-check", () => {
  const blockedEmailDomainRepository = container.resolve(BlockedEmailDomainRepository);
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;

  it("rejects a caller with no token", async () => {
    const response = await check({ email: "someone@example.com" }, { token: undefined });

    expect(response.status).toBe(401);
  });

  it("rejects a caller with the wrong token", async () => {
    const response = await check({ email: "someone@example.com" }, { token: faker.string.alphanumeric(32) });

    expect(response.status).toBe(401);
  });

  it("reports a blocked domain without saying why", async () => {
    const domain = await seedDomain("blocked");

    const response = await check({ email: `miner@${domain}` });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ blocked: true });
  });

  it("does not cache the verdict downstream, since the address is personal data", async () => {
    const domain = await seedDomain("blocked");

    const response = await check({ email: `miner@${domain}` });

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports a domain an operator has allowed as not blocked", async () => {
    const domain = await seedDomain("allowed");

    const response = await check({ email: `someone@${domain}` });

    expect(await response.json()).toEqual({ blocked: false });
  });

  it("reports an unknown domain as not blocked", async () => {
    const response = await check({ email: `someone@${uniqueDomain()}` });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ blocked: false });
  });

  it.each(["not-an-address", "@", "", "a", `${faker.string.alphanumeric(400)}@example.com`])(
    "reports %j as not blocked rather than rejecting it",
    async email => {
      const response = await check({ email });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ blocked: false });
    }
  );

  it("rejects a body without an email through the shared error handler", async () => {
    const response = await check({});

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "BadRequestError", code: "validation_error" });
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain("validateEmailDomain");
  });

  function uniqueDomain() {
    return `${faker.string.alphanumeric(16).toLowerCase()}.com`;
  }

  async function seedDomain(status: "blocked" | "allowed") {
    const domain = uniqueDomain();
    await blockedEmailDomainRepository.create({ domain, status, source: "manual" });
    return domain;
  }

  async function check(body: Record<string, unknown>, options: { token?: string } = { token: internalToken }) {
    return await app.request(PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { "x-console-internal-token": options.token } : {})
      },
      body: JSON.stringify(body)
    });
  }
});
