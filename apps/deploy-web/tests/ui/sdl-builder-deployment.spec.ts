import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "./fixture/base-test";
import { BuildTemplatePage } from "./pages/BuildTemplatePage";

test.describe("SDL Builder Deployment Flow", () => {
  test("navigate to SDL builder page", async ({ page, context }) => {
    const { sdlBuilderPage } = await setup({ page, context });

    await expect(sdlBuilderPage.getDeployButton()).toBeVisible();
    await expect(sdlBuilderPage.getPreviewButton()).toBeVisible();
    await expect(sdlBuilderPage.getAddServiceButton()).toBeVisible();
  });

  test("fill image name and preview SDL", async ({ page, context }) => {
    const { sdlBuilderPage } = await setup({ page, context, imageName: "nginx:latest" });

    await sdlBuilderPage.clickPreview();

    await expect(sdlBuilderPage.getPreviewTextLocator("nginx:latest")).toBeVisible();
    await expect(sdlBuilderPage.getPreviewTextLocator("version:")).toBeVisible();
    await expect(sdlBuilderPage.getPreviewTextLocator("services:")).toBeVisible();

    await sdlBuilderPage.closePreview();
  });

  test("create deployment from SDL builder", async ({ page, context }) => {
    const { sdlBuilderPage } = await setup({ page, context, imageName: "nginx:alpine" });

    await sdlBuilderPage.clickDeploy();

    await expect(page.getByTestId("connect-wallet-btn").first()).toBeVisible({ timeout: 10000 });
  });

  test("add multiple services", async ({ page, context }) => {
    const { sdlBuilderPage } = await setup({ page, context, imageName: "nginx:latest" });

    await sdlBuilderPage.addService();

    await sdlBuilderPage.waitForServiceAdded("service-2");

    await sdlBuilderPage.clickPreview();
    await expect(sdlBuilderPage.getPreviewTextLocator("service-1")).toBeVisible();
    await expect(sdlBuilderPage.getPreviewTextLocator("service-2")).toBeVisible();
    await sdlBuilderPage.closePreview();
  });

  test("preview SDL with different images", async ({ page, context }) => {
    const { sdlBuilderPage } = await setup({ page, context });

    const images = ["postgres:15", "redis:7", "node:18-alpine"];

    for (const image of images) {
      await sdlBuilderPage.fillImageName(image);
      await sdlBuilderPage.clickPreview();
      await expect(sdlBuilderPage.getPreviewTextLocator(image)).toBeVisible();
      await sdlBuilderPage.closePreview();
    }
  });

  test("verify SDL YAML structure", async ({ page, context }) => {
    const { sdlBuilderPage } = await setup({ page, context, imageName: "ubuntu:22.04" });

    await sdlBuilderPage.clickPreview();

    await expect(sdlBuilderPage.getPreviewTextLocator("version:")).toBeVisible();
    await expect(sdlBuilderPage.getPreviewTextLocator("services:")).toBeVisible();
    await expect(sdlBuilderPage.getPreviewTextLocator("profiles:")).toBeVisible();
    await expect(sdlBuilderPage.getPreviewTextLocator("deployment:")).toBeVisible();

    await sdlBuilderPage.closePreview();
  });

  test("add service then preview shows both services", async ({ page, context }) => {
    const { sdlBuilderPage } = await setup({ page, context, imageName: "nginx:latest" });

    await sdlBuilderPage.addService();
    await sdlBuilderPage.waitForServiceAdded("service-2");

    await sdlBuilderPage.clickPreview();

    await expect(sdlBuilderPage.getServiceLocator("service-1")).toBeVisible();
    await expect(sdlBuilderPage.getServiceLocator("service-2")).toBeVisible();

    await sdlBuilderPage.closePreview();
  });

  test("preview button always available with valid image", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("alpine:latest");

    await expect(sdlBuilderPage.getPreviewButton()).toBeEnabled();
  });

  async function setup({ page, context, imageName }: { page: Page; context: BrowserContext; imageName?: string }) {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    if (imageName) {
      await sdlBuilderPage.fillImageName(imageName);
    }

    return { sdlBuilderPage };
  }
});
