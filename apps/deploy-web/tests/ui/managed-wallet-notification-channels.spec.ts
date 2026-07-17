import { expect, test } from "./fixture/base-test";
import { AlertsPage } from "./pages/AlertsPage";
import { AppNav } from "./pages/AppNav";
import { NotificationChannelsPage } from "./pages/NotificationChannelsPage";

test.describe("Managed wallet notification channels", () => {
  test.use({ userType: "existing" });

  const channelName = `e2e-channel-${Date.now()}`;
  const channelEmail = `e2e-channel-${Date.now()}@test.example.com`;

  test("creates and deletes a notification channel", async ({ page }) => {
    const appNav = new AppNav(page);
    const alertsPage = new AlertsPage(page);
    const notificationChannelsPage = new NotificationChannelsPage(page);

    await test.step("navigate to notification channels tab", async () => {
      await appNav.openAlerts();
      await alertsPage.waitForPage();
      await alertsPage.openNotificationChannelsTab();
      await page.waitForURL(/\/alerts\/notification-channels$/);
    });

    await test.step("create notification channel", async () => {
      await notificationChannelsPage.openCreate();
      await notificationChannelsPage.fillForm({ name: channelName, emails: channelEmail });
      await notificationChannelsPage.submitForm();
      await page.waitForURL(/\/alerts\/notification-channels$/, { timeout: 10_000 });
      const notification = page.getByRole("alert").filter({ hasText: "Notification channel created" });
      await expect(notification).toBeVisible({ timeout: 10_000 });
      await notification.getByRole("button").click();
    });

    await test.step("verify channel appears in list", async () => {
      await notificationChannelsPage.ensureOnTheLastPage();
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
