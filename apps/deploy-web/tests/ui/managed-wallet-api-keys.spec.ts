import { expect, test } from "./fixture/authenticated-test";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";

test.describe("Managed wallet API keys", () => {
  const keyName = `e2e-test-${Date.now()}`;

  test("creates and deletes an API key", async ({ page, login }) => {
    const homePage = new HomePage(page);
    const authPage = new AuthPage(page);
    const apiKeysPage = new ApiKeysPage(page);

    await test.step("login", async () => {
      await homePage.goto();
      await homePage.openSignIn();
      await authPage.waitForPage();
      await login();
    });

    await test.step("navigate to API keys via account menu", async () => {
      await page.getByRole("button", { name: /account menu/i }).click();
      await page.getByText("API Keys").click();
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
