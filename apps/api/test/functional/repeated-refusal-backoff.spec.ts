import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core";
import { app } from "@src/rest-app";

import { WalletTestingService } from "@test/services/wallet-testing.service";

describe("Repeated refusal backoff", () => {
  it("tells a user to back off once the same request keeps being refused, without holding back anyone else", async () => {
    const { walletService, limit, backoffSeconds } = setup();
    const { token } = await walletService.createRegisteredUser();
    const { token: otherToken } = await walletService.createRegisteredUser();

    for (let attempt = 0; attempt < limit; attempt++) {
      expect((await postInvalidDeployment(token)).status).toBe(400);
    }
    const throttled = await postInvalidDeployment(token);
    const otherUsersRequest = await postInvalidDeployment(otherToken);

    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("Retry-After")).toBe(String(backoffSeconds));
    expect(await throttled.json()).toMatchObject({ code: "repeated_refusal" });
    expect(otherUsersRequest.status).toBe(400);
  });

  function postInvalidDeployment(token: string) {
    return app.request("/v1/deployments", {
      method: "POST",
      body: JSON.stringify({ data: {} }),
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }
    });
  }

  function setup() {
    const config = container.resolve(CORE_CONFIG);

    return {
      walletService: new WalletTestingService(app),
      limit: config.REPEATED_REFUSAL_LIMIT,
      backoffSeconds: config.REPEATED_REFUSAL_BACKOFF_SECONDS
    };
  }
});
