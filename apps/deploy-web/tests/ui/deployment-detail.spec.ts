import { expect, test } from "./fixture/base-test";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";

const DETAIL_TABS = ["Details", "Logs", "Events", "Shell", "Update", "Settings"];

/**
 * Summary tiles that render whatever the escrow-abstraction flags say. BALANCE, AUTO TOP-UP and RUNTIME LIMIT share a
 * slot that swaps with those flags and with the deployment's runtime limit, and e2e cannot pin flags on a deployed
 * environment, so that slot is left to DeploymentDetailHeader.spec.tsx. vCPU is left out because the placement card
 * repeats it, which would trip strict mode.
 */
const FLAG_INDEPENDENT_SUMMARY_TILES = ["COST", "GPU", "MEMORY", "STORAGE"];

test.describe("Deployment detail", () => {
  test.use({ userType: "existing" });

  test("renders the header, tabs and placements for a fresh deployment", async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);

    const configure = new ConfigureDeploymentPage(page);
    let dseq: string;

    await test.step("deploy a container through the configure flow", async () => {
      await configure.open();
      await configure.fillImageName("nginx:latest");
      await configure.requestQuotes();
      await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 180_000 });

      await configure.selectFirstAvailableProvider();
      await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
      await configure.confirmAndDeploy();
      await page.waitForURL(/\/deployments\/\d+/, { timeout: 180_000 });

      const match = page.url().match(/deployments\/(\d+)/);
      if (!match) throw new Error(`Could not extract DSEQ from URL: ${page.url()}`);
      dseq = match[1];
    });

    await test.step("renders the summary header and full tab bar", async () => {
      await expect(page.getByText("TOTAL SERVICES", { exact: true })).toBeVisible({ timeout: 30_000 });

      for (const tile of FLAG_INDEPENDENT_SUMMARY_TILES) {
        await expect(page.getByText(tile, { exact: true })).toBeVisible();
      }

      for (const tab of DETAIL_TABS) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
      }
    });

    await test.step("lands on the Events tab so the workload's first events are in view", async () => {
      await expect(page.getByRole("tab", { name: "Events" })).toHaveAttribute("aria-selected", "true");
    });

    await test.step("shows the placements & services overview on the Details tab", async () => {
      await page.getByRole("tab", { name: "Details" }).click();

      await expect(page.getByText("Placements", { exact: true })).toBeVisible({ timeout: 30_000 });

      const service = page.getByRole("button", { name: /service-1/ });
      await expect(service).toBeVisible();

      await service.click();
      await expect(service).toHaveAttribute("aria-expanded", "true");
    });

    await test.step("switches tabs via the tab query param without navigating", async () => {
      await page.getByRole("tab", { name: "Events" }).click();
      await expect(page).toHaveURL(new RegExp(`/deployments/${dseq!}\\?tab=EVENTS`));
    });
  });
});
