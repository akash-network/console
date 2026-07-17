import { expect, test } from "./fixture/base-test";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { AppNav } from "./pages/AppNav";

test.describe("Managed wallet API keys", () => {
  test.use({ userType: "existing" });

  const keyName = `e2e-test-${Date.now()}`;

  test("creates and deletes an API key", async ({ page }) => {
    const apiKeysPage = new ApiKeysPage(page);

    await test.step("navigate to API keys", async () => {
      await new AppNav(page).openApiKeys();
      await apiKeysPage.waitForPage();
    });

    await test.step("create API key", async () => {
      await apiKeysPage.createKey(keyName);
      await expect(apiKeysPage.getSaveKeyDialog()).toBeVisible({ timeout: 10_000 });
      await apiKeysPage.dismissSaveDialog();
    });

    await test.step("verify key appears in list", async () => {
      await expect(apiKeysPage.getKeyRow(keyName)).toBeVisible({ timeout: 10_000 });
    });

    await test.step("delete API key", async () => {
      await apiKeysPage.deleteKey(keyName);
    });

    await test.step("verify key is removed", async () => {
      await expect(apiKeysPage.getKeyRow(keyName)).toBeHidden({ timeout: 10_000 });
    });
  });
});
