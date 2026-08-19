import type { Browser } from "@playwright/test";
import { chromium } from "@playwright/test";

import { loginExistingUser } from "../actions/auth";
import { closeAllActiveDeployments } from "../actions/deployment-janitor";
import { injectUIConfig, routeTestingClientToken } from "./base-test";
import { testEnvConfig } from "./test-env.config";
import { getUserAgent } from "./user-agent";

/**
 * CI installs chromium with `--no-shell`, so a channel-less headless launch would resolve to the headless-shell
 * binary that install skipped. The `chromium` project pins the same channel for the same reason.
 * https://github.com/microsoft/playwright/issues/33566
 */
const BROWSER_CHANNEL = "chromium";

/**
 * Last line of defence for the shared TEST_USER account. Per-test teardown already hands each account back empty,
 * but a worker that dies outright never gets there, and a leftover from an earlier run keeps draining escrow until
 * someone notices. This signs in once at the end of the run and closes whatever is still active.
 *
 * Deliberately never fails the run: a cleanup that reports a broken suite would send everyone chasing the wrong
 * thing. What it cannot close it says out loud instead. Launching the browser is part of what it guards, since a
 * runner out of resources at the very end of a run would otherwise fail an already-green suite.
 */
export default async function closeDeploymentsLeftByTheRun() {
  if (!testEnvConfig.TEST_USER_EMAIL || !testEnvConfig.TEST_USER_PASSWORD) return;

  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ channel: BROWSER_CHANNEL });
    const page = await browser.newPage({ userAgent: getUserAgent() });

    await injectUIConfig(page);
    await routeTestingClientToken(page);
    await loginExistingUser(page);

    const closed = await closeAllActiveDeployments(page, testEnvConfig.BASE_URL);

    if (closed.length) {
      console.warn(`[global-teardown] closed ${closed.length} deployment(s) the run left behind: ${closed.join(", ")}`);
    }
  } catch (error) {
    console.warn(`[global-teardown] could not sweep the test account: ${error instanceof Error ? error.message : error}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
