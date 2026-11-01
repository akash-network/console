import { faker } from "@faker-js/faker";
import { decodeJwt } from "jose";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { app } from "@src/rest-app";

import { WalletTestingService } from "@test/services/wallet-testing.service";

describe("Access token validation", () => {
  const walletTestingService = new WalletTestingService(app);

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("signs in a user with an access token issued for this API", async () => {
    const { user, token } = await walletTestingService.createRegisteredUser();

    const response = await getCurrentUser(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: user.id } });
  });

  it("rejects an access token once it has expired", async () => {
    const { token } = await walletTestingService.createRegisteredUser();
    vi.useFakeTimers({ toFake: ["Date"], now: (decodeJwt(token).exp! + 60) * 1000 });

    expect((await getCurrentUser(token)).status).toBe(401);
    expect((await registerUser(token)).status).toBe(401);
  });

  it("rejects an access token before it becomes valid", async () => {
    const { token } = await walletTestingService.createRegisteredUser();
    vi.useFakeTimers({ toFake: ["Date"], now: (decodeJwt(token).nbf! - 60) * 1000 });

    expect((await getCurrentUser(token)).status).toBe(401);
    expect((await registerUser(token)).status).toBe(401);
  });

  function getCurrentUser(token: string) {
    return app.request("/v1/user/me", { headers: { authorization: `Bearer ${token}` } });
  }

  function registerUser(token: string) {
    return app.request("/v1/register-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ wantedUsername: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email().toLowerCase(), emailVerified: true })
    });
  }
});
