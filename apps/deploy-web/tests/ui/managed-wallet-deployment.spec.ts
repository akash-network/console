import { expect, test } from "./fixture/authenticated-test";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";

test.describe("Managed wallet deployment", () => {
  test("logs in with existing user", async ({ page, login }) => {
    const homePage = new HomePage(page);
    const authPage = new AuthPage(page);

    await homePage.goto();
    await homePage.openSignIn();

    await authPage.waitForPage();
    await login();

    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: /account menu/i }).hover();
    await expect(page.getByRole("menuitem", { name: /logout/i })).toBeVisible();
  });
});
