import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";

const APPROVE_PATH = "/internal/affiliates";

describe("POST /internal/affiliates", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const userRepository = container.resolve(UserRepository);

  it("rejects a caller with no token", async () => {
    const response = await approve({ userId: faker.string.uuid(), actor: "ops@akash.network" }, { token: undefined });

    expect(response.status).toBe(401);
  });

  it("rejects a caller with the wrong token", async () => {
    const response = await approve({ userId: faker.string.uuid(), actor: "ops@akash.network" }, { token: faker.string.alphanumeric(32) });

    expect(response.status).toBe(401);
  });

  it("approves a user as an affiliate with a generated code", async () => {
    const user = await seedUser();

    const response = await approve({ userId: user.id, actor: "ops@akash.network" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { userId: user.id, code: expect.stringMatching(/^[a-z0-9]{8}$/) } });
  });

  it("does not cache the response, since it names a user", async () => {
    const user = await seedUser();

    const response = await approve({ userId: user.id, actor: "ops@akash.network" });

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects approving the same user twice with a conflict", async () => {
    const user = await seedUser();
    await approve({ userId: user.id, actor: "ops@akash.network" });

    const response = await approve({ userId: user.id, actor: "ops@akash.network" });

    expect(response.status).toBe(409);
  });

  it("round-trips approving then revoking the same affiliate", async () => {
    const user = await seedUser();
    const approveResponse = await approve({ userId: user.id, actor: "ops@akash.network" });
    const { data: approved } = await approveResponse.json();

    const revokeResponse = await revoke(approved.code, { actor: "ops@akash.network" });

    expect(revokeResponse.status).toBe(200);
    expect(await revokeResponse.json()).toMatchObject({ data: { id: approved.id, code: approved.code } });
  });

  it("rejects revoking an unknown code", async () => {
    const response = await revoke("unknown-code", { actor: "ops@akash.network" });

    expect(response.status).toBe(404);
  });

  it("rejects revoking with no token", async () => {
    const response = await revoke("some-code", { actor: "ops@akash.network" }, { token: undefined });

    expect(response.status).toBe(401);
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    expect(response.status).toBe(200);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("approveAffiliate");
    expect(text).not.toContain("revokeAffiliate");
  });

  async function seedUser() {
    return userRepository.create({ email: faker.internet.email(), username: faker.internet.userName() });
  }

  async function approve(body: Record<string, unknown>, options: { token?: string } = { token: internalToken }) {
    return app.request(APPROVE_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { "x-console-internal-token": options.token } : {})
      },
      body: JSON.stringify({ data: body })
    });
  }

  async function revoke(code: string, body: Record<string, unknown>, options: { token?: string } = { token: internalToken }) {
    return app.request(`${APPROVE_PATH}/${code}/revoke`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { "x-console-internal-token": options.token } : {})
      },
      body: JSON.stringify({ data: body })
    });
  }
});
