import type { Page } from "@playwright/test";

import { skipUnlessOnboardingRedesign } from "./actions/feature-flags";
import { expect, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { AppNav } from "./pages/AppNav";

/**
 * Exercises the onboarding gate's routing contract with `onboarding_redesign_v1` enabled (the test env has it on):
 * a not-onboarded user is confined to the onboarding + first-deploy path, an onboarded user is kept out of
 * onboarding but free inside the app, deploy entry points route to the configure screen, and public pages are
 * never gated. The full not-onboarded→onboarded transition — including the `/deployments/{dseq}` allow-list
 * while a deployment exists but has no lease yet — is exercised as a real deploy in onboarding-journey.spec.ts.
 * The flag-off (WalletBasedGate) path and the git/redeploy link fall-through stay in the RequireOnboarding /
 * useNewDeploymentUrl / RedirectMappableBuilderToConfigure unit specs (no per-test flag toggle here; git can
 * trigger an OAuth redirect that muddies a URL assertion).
 */

/** A stable, always-present awesome-akash template id used to shape inbound deploy links. */
const TEMPLATE_ID = "akash-network-awesome-akash-Llama-3.1-8B";

test.describe("Onboarding gate — not-onboarded user", () => {
  test.use({ userType: "new" });

  test.beforeEach(async ({ page }) => {
    await skipUnlessOnboardingRedesign(page);
  });

  test("is confined to the onboarding and first-deploy path", async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    await test.step("bounced from the app home to /onboarding", async () => {
      await visit(page, "/");
      await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
    });

    await test.step("bounced from the deployments list to /onboarding", async () => {
      await visit(page, "/deployments");
      await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
    });

    await test.step("allowed on the configure screen", async () => {
      await visit(page, "/new-deployment/configure");
      await expect(page.getByRole("heading", { name: "Configure your deployment" })).toBeVisible({ timeout: 30_000 });
    });

    await test.step("allowed on the onboarding picker", async () => {
      await visit(page, "/onboarding");
      await expect(page.getByRole("heading", { name: /deploy your first app/i })).toBeVisible({ timeout: 30_000 });
    });
  });
});

test.describe("Onboarding gate — onboarded user", () => {
  test.use({ userType: "existing" });

  test.beforeEach(async ({ page }) => {
    await skipUnlessOnboardingRedesign(page);
  });

  test("faces none of the restrictions an onboarding user has", async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    await test.step("visiting /onboarding sends them into the console instead of keeping them there", async () => {
      await visit(page, "/onboarding");
      await page.waitForURL(url => new URL(url).pathname !== "/onboarding", { timeout: 60_000 });
    });

    await test.step("can open the deployments list — where a not-onboarded user is bounced", async () => {
      await visit(page, "/deployments");
      await expect(page).toHaveURL(/\/deployments(\?|$)/, { timeout: 60_000 });
    });

    await test.step("can open the app home — where a not-onboarded user is bounced", async () => {
      await visit(page, "/");
      await expect(new AppNav(page).accountMenuButton()).toBeVisible({ timeout: 60_000 });
    });
  });

  test("keeps the classic picker as the deploy entry and sends template/edit links to configure", async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    await test.step("an in-app Deploy link points at the classic new-deployment picker, not configure", async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await visit(page, "/deployments");
      await expect(page).toHaveURL(/\/deployments(\?|$)/, { timeout: 30_000 });
      await expect(page.getByRole("link", { name: "Deploy" }).first()).toHaveAttribute("href", /\/new-deployment(\?|$)/, { timeout: 30_000 });
    });

    await test.step("the classic deployment-type/template picker is reachable and renders", async () => {
      await visit(page, "/new-deployment");
      await expect(page).toHaveURL(/\/new-deployment(\?|$)/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Build Your Own" })).toBeVisible({ timeout: 30_000 });
    });

    await test.step("an inbound edit-deployment link redirects to configure", async () => {
      await visit(page, `/new-deployment?step=edit-deployment&templateId=${TEMPLATE_ID}`);
      await page.waitForURL(/\/new-deployment\/configure/, { timeout: 30_000 });
    });

    await test.step("an inbound templateId link redirects to configure", async () => {
      await visit(page, `/new-deployment?templateId=${TEMPLATE_ID}`);
      await page.waitForURL(/\/new-deployment\/configure/, { timeout: 30_000 });
    });
  });
});

test.describe("Onboarding gate — public pages", () => {
  test("does not gate a logged-out visitor on a public page", async ({ page }) => {
    await visit(page, "/login");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/onboarding/);
  });
});

/**
 * Navigates and returns as soon as the navigation commits, without blocking on `load`. The gate redirects
 * client-side the instant it knows the user's onboarding state, and some app pages hold long-lived connections
 * that never fire `load` — waiting for either makes the default `goto` either race the redirect (re-pinning the
 * origin URL) or hang. Assertions below each call (`waitForURL`, `toBeVisible`, `toHaveURL`) do the real waiting.
 */
async function visit(page: Page, path: string) {
  await page.goto(`${testEnvConfig.BASE_URL}${path}`, { waitUntil: "commit" });
}
