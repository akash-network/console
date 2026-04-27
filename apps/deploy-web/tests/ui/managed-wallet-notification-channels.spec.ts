import { expect, test } from "./fixture/authenticated-test";
import { AlertsPage } from "./pages/AlertsPage";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { NotificationChannelsPage } from "./pages/NotificationChannelsPage";
import { Sidebar } from "./pages/Sidebar";

test.describe("Managed wallet notification channels", () => {
  const channelName = `e2e-channel-${Date.now()}`;
  const channelEmail = `e2e-channel-${Date.now()}@test.example.com`;

  test("creates and deletes a notification channel", async ({ page, login }) => {
    const homePage = new HomePage(page);
    const authPage = new AuthPage(page);
    const sidebar = new Sidebar(page);
    const alertsPage = new AlertsPage(page);
    const notificationChannelsPage = new NotificationChannelsPage(page);

    await test.step("login", async () => {
      await homePage.goto();
      await homePage.openSignIn();
      await authPage.waitForPage();
      await login();
    });

    await test.step("navigate to notification channels tab", async () => {
      await sidebar.openAlerts();
      await alertsPage.waitForPage();
      await alertsPage.openNotificationChannelsTab();
      await page.waitForURL(/\/alerts\/notification-channels$/);
    });

    await test.step("create notification channel", async () => {
      await notificationChannelsPage.openCreate();
      await notificationChannelsPage.fillForm({ name: channelName, emails: channelEmail });
      await notificationChannelsPage.submitForm();
      await page.waitForURL(/\/alerts\/notification-channels$/, { timeout: 10_000 });
    });

    await test.step("verify channel appears in list", async () => {
      const row = notificationChannelsPage.getChannelRow(channelName);
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(row).toContainText("email");
      await expect(row).toContainText(channelEmail);
    });

    await test.step("delete notification channel", async () => {
      await notificationChannelsPage.deleteChannel(channelName);
      await expect(page.getByText("Notification channel removed")).toBeVisible({ timeout: 10_000 });
    });

    await test.step("verify channel is removed", async () => {
      await expect(notificationChannelsPage.getChannelRow(channelName)).toBeHidden({ timeout: 10_000 });
    });
  });
});
