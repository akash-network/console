import { ApiError } from "@akashnetwork/openapi-sdk";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { isWalletProvisioning } from "./walletProvisioning";

describe("isWalletProvisioning", () => {
  it("matches the openapi-sdk ApiError from the deployment path", () => {
    expect(isWalletProvisioning(new ApiError(409, { code: "wallet_provisioning" }, "POST /v1/deployments → 409"))).toBe(true);
  });

  it("matches the http-sdk AxiosError from the top-up path", () => {
    const error = Object.assign(new AxiosError("Request failed with status code 409"), { response: { data: { code: "wallet_provisioning" } } });

    expect(isWalletProvisioning(error)).toBe(true);
  });

  it("returns false for a different error code or a plain error", () => {
    expect(isWalletProvisioning(new ApiError(402, { code: "insufficient_funds" }, "402"))).toBe(false);
    expect(isWalletProvisioning(Object.assign(new AxiosError("boom"), { response: { data: { code: "something_else" } } }))).toBe(false);
    expect(isWalletProvisioning(new Error("plain"))).toBe(false);
  });
});
