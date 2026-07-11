import { ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiUrlService } from "@src/services/api-url/api-url.service";
import { createAppRootContainer } from "./app-di-container";

describe(createAppRootContainer.name, () => {
  it("creates the managed wallet service from the http-sdk", () => {
    const { container } = setup();

    expect(container.managedWalletService).toBeInstanceOf(ManagedWalletHttpService);
  });

  function setup() {
    const container = createAppRootContainer({
      runtimeEnv: "browser",
      BASE_API_MAINNET_URL: "http://localhost:3080",
      BASE_PROVIDER_PROXY_URL: "http://localhost:3040",
      MANAGED_WALLET_NETWORK_ID: "mainnet",
      apiUrlService: () => mock<ApiUrlService>()
    });

    return { container };
  }
});
