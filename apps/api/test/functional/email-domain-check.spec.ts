import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { app } from "@src/rest-app";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";

const INTERNAL_TOKEN = "functional-test-internal-token-000000";
const PATH = "/internal/auth/email-domain-check";

describe("POST /internal/auth/email-domain-check", () => {
  const blockedEmailDomainRepository = container.resolve(BlockedEmailDomainRepository);

  it("rejects a caller with no token", async () => {
    const response = await check({ email: "someone@example.com" }, { token: undefined });

    expect(response.status).toBe(401);
  });

  it("rejects a caller with the wrong token", async () => {
    const response = await check({ email: "someone@example.com" }, { token: "wrong-token" });

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

  it("reports an unparsable address as not blocked rather than rejecting it", async () => {
    const response = await check({ email: "not-an-address" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ blocked: false });
  });

  it("rejects a body without an email", async () => {
    const response = await check({});

    expect(response.status).toBe(400);
  });

  function uniqueDomain() {
    return `${faker.string.alphanumeric(16).toLowerCase()}.com`;
  }

  async function seedDomain(status: "blocked" | "allowed") {
    const domain = uniqueDomain();
    await blockedEmailDomainRepository.create({ domain, status, source: "manual" });
    return domain;
  }

  async function check(body: Record<string, unknown>, options: { token?: string } = { token: INTERNAL_TOKEN }) {
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
