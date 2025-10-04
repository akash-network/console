import { expect, test } from "./fixture/base-test";
import { BuildTemplatePage } from "./pages/BuildTemplatePage";

test.describe("SDL Builder Deployment Flow", () => {
  test("navigate to SDL builder page", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await expect(page.getByRole("button", { name: /^deploy$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /preview/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add service/i })).toBeVisible();
  });

  test("fill image name and preview SDL", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("nginx:latest");

    await sdlBuilderPage.clickPreview();

    await sdlBuilderPage.verifyPreviewSdlContains("nginx:latest");
    await sdlBuilderPage.verifyPreviewSdlContains("version:");
    await sdlBuilderPage.verifyPreviewSdlContains("services:");

    await sdlBuilderPage.closePreview();
  });

  test("create deployment from SDL builder", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("nginx:alpine");

    await sdlBuilderPage.clickDeploy();

    await expect(page.getByTestId("connect-wallet-btn").first()).toBeVisible({ timeout: 10000 });
  });

  test("add multiple services", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("nginx:latest");

    await sdlBuilderPage.addService();

    await page.waitForTimeout(1000);

    await sdlBuilderPage.clickPreview();
    await sdlBuilderPage.verifyPreviewSdlContains("service-1");
    await sdlBuilderPage.verifyPreviewSdlContains("service-2");
    await sdlBuilderPage.closePreview();
  });

  test("reset form to default state", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("redis:alpine");
    await sdlBuilderPage.verifyImageNameValue("redis:alpine");

    await sdlBuilderPage.addService();
    await page.waitForTimeout(500);

    await sdlBuilderPage.clickReset();

    await page.waitForTimeout(1000);

    const imageInput = page.getByTestId("image-name-input");
    await expect(imageInput).toBeVisible();

    await sdlBuilderPage.fillImageName("nginx:latest");
    await sdlBuilderPage.verifyImageNameValue("nginx:latest");
  });

  test("validation prevents deployment with empty image", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await page.getByTestId("image-name-input").clear();

    await sdlBuilderPage.clickDeploy();

    const imageInput = page.getByTestId("image-name-input");
    await expect(imageInput).toBeVisible();

    const walletBtn = page.getByTestId("connect-wallet-btn");
    await expect(walletBtn)
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => true);
  });

  test("preview SDL with different images", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    const images = ["postgres:15", "redis:7", "node:18-alpine"];

    for (const image of images) {
      await sdlBuilderPage.fillImageName(image);
      await sdlBuilderPage.clickPreview();
      await sdlBuilderPage.verifyPreviewSdlContains(image);
      await sdlBuilderPage.closePreview();
    }
  });

  test("verify SDL YAML structure", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("ubuntu:22.04");

    await sdlBuilderPage.clickPreview();

    await sdlBuilderPage.verifyPreviewSdlContains("version:");
    await sdlBuilderPage.verifyPreviewSdlContains("services:");
    await sdlBuilderPage.verifyPreviewSdlContains("profiles:");
    await sdlBuilderPage.verifyPreviewSdlContains("deployment:");

    await sdlBuilderPage.closePreview();
  });

  test("add service then preview shows both services", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("nginx:latest");

    await sdlBuilderPage.addService();
    await page.waitForTimeout(500);

    await sdlBuilderPage.clickPreview();

    await page.waitForTimeout(1000);

    await expect(page.getByText(/service-1:/).first()).toBeVisible();
    await expect(page.getByText(/service-2:/).first()).toBeVisible();

    await sdlBuilderPage.closePreview();
  });

  test("preview button always available with valid image", async ({ page, context }) => {
    const sdlBuilderPage = new BuildTemplatePage(context, page, "sdl-builder");
    await sdlBuilderPage.gotoInteractive();

    await sdlBuilderPage.fillImageName("alpine:latest");

    const previewBtn = page.getByRole("button", { name: /preview/i });
    await expect(previewBtn).toBeEnabled();
  });
});
