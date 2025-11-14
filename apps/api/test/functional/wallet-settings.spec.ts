import type { WalletSettingsResponse } from "@src/billing/http-schemas/wallet.schema";
import { app } from "@src/rest-app";

import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(20000);

describe("wallet-settings", () => {
  it("completes full CRUD cycle for wallet settings", async () => {
    const { token } = await setup();
    const headers = new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` });

    // 1. Create (POST) - Creates wallet settings
    const createResponse = await app.request("/v1/wallet-settings", {
      method: "POST",
      body: JSON.stringify({
        data: {
          autoReloadEnabled: true,
          autoReloadThreshold: 30.5,
          autoReloadAmount: 50.0
        }
      }),
      headers
    });

    expect(createResponse.status).toBe(200);
    const createResult = (await createResponse.json()) as WalletSettingsResponse;

    expect(createResult.data).toMatchObject({
      autoReloadEnabled: true,
      autoReloadThreshold: 30.5,
      autoReloadAmount: 50.0
    });

    // 2. Read (GET) - Verifies the created settings
    const getAfterCreateResponse = await app.request("/v1/wallet-settings", {
      method: "GET",
      headers
    });

    expect(getAfterCreateResponse.status).toBe(200);
    const getAfterCreateResult = (await getAfterCreateResponse.json()) as WalletSettingsResponse;

    expect(getAfterCreateResult.data).toMatchObject({
      autoReloadEnabled: true,
      autoReloadThreshold: 30.5,
      autoReloadAmount: 50.0
    });

    // 3. Update (PUT) - Updates the settings
    const updateResponse = await app.request("/v1/wallet-settings", {
      method: "PUT",
      body: JSON.stringify({
        data: {
          autoReloadEnabled: false,
          autoReloadThreshold: 20.75
        }
      }),
      headers
    });

    expect(updateResponse.status).toBe(200);
    const updateResult = (await updateResponse.json()) as WalletSettingsResponse;

    expect(updateResult.data).toMatchObject({
      autoReloadEnabled: false,
      autoReloadThreshold: 20.75,
      autoReloadAmount: 50.0
    });

    // 4. Read (GET) - Verifies the updated settings
    const getAfterUpdateResponse = await app.request("/v1/wallet-settings", {
      method: "GET",
      headers
    });

    expect(getAfterUpdateResponse.status).toBe(200);
    const getAfterUpdateResult = (await getAfterUpdateResponse.json()) as WalletSettingsResponse;

    expect(getAfterUpdateResult.data).toMatchObject({
      autoReloadEnabled: false,
      autoReloadThreshold: 20.75,
      autoReloadAmount: 50.0
    });

    // 5. Delete (DELETE) - Deletes the settings
    const deleteResponse = await app.request("/v1/wallet-settings", {
      method: "DELETE",
      headers
    });

    expect(deleteResponse.status).toBe(204);

    // 6. Read (GET) - Verifies the settings are deleted (404)
    const getAfterDeleteResponse = await app.request("/v1/wallet-settings", {
      method: "GET",
      headers
    });

    expect(getAfterDeleteResponse.status).toBe(404);
  });

  async function setup() {
    const walletService = new WalletTestingService(app);
    const { user, token, wallet } = await walletService.createUserAndWallet();
    return { user, token, wallet };
  }
});
