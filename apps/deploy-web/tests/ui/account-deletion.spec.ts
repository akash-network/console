import type { APIRequestContext, APIResponse, Page } from "@playwright/test";

import { signInPasswordless } from "./actions/auth";
import { acceptFairUsePolicyIfPrompted } from "./actions/fair-use-policy";
import { expect, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { ConfirmAccountDeletionPage } from "./pages/ConfirmAccountDeletionPage";
import { OnboardingPickerPage } from "./pages/OnboardingPickerPage";
import { ProfilePage } from "./pages/ProfilePage";
import type { Auth0ManagementService } from "./services/auth0-management.service";
import { createInboxClient } from "./services/email-verification";
import type { InboxClient } from "./services/email-verification/inbox-client";
import { waitForEmail } from "./services/inbox-email";

const API_URL = `${testEnvConfig.BASE_URL}/api/proxy`;

const DELETION_EMAIL_SUBJECT = "Confirm your Akash Console account deletion";

/** A new account's trial wallet comes from a queued job, and the api refuses to spend from it until the job lands. */
const WALLET_PROVISIONING_DEADLINE_MS = 3 * 60_000;

/** The deleted account's sign-in is removed from Auth0 by a queued job after the deletion commits. */
const AUTH0_PURGE_DEADLINE_MS = 3 * 60_000;

const POLL_INTERVALS_MS = [5_000];

const SDL = `---
version: "2.0"
services:
  web:
    image: ghcr.io/akash-network/hello-akash-world:2.1.0
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

type DeploymentList = { data: { deployments: { deployment: { id: { dseq: string } } }[] } };

test.describe("Account deletion", () => {
  test.setTimeout(8 * 60_000);

  test("a user closes their deployment, deletes the account from the emailed link, and the same email then starts over", async ({ page, auth0 }) => {
    const inbox = createInboxClient();
    const email = inbox.generateEmail();
    const keyName = `e2e-deleted-account-key-${Date.now()}`;
    const profile = new ProfilePage(page);
    const apiKeys = new ApiKeysPage(page);
    let activeDseq: string | undefined;

    try {
      await test.step("a new user signs up by email code and skips onboarding", async () => {
        await signUpAndSkipOnboarding(page, email);
      });

      const deletedAccount = await test.step("the user creates an API key in the app and a deployment through the API", async () => {
        await apiKeys.goto();
        await apiKeys.createKey(keyName);
        await expect(apiKeys.getCreatedKeySecret(keyName)).not.toBeEmpty({ timeout: 10_000 });
        await apiKeys.closeCreatedKeyDialog(keyName);
        activeDseq = await createDeployment(page.request);

        return { dseq: activeDseq, walletAddress: await waitForWalletAddress(page.request) };
      });

      await test.step("deletion is refused while the deployment is active", async () => {
        await profile.goto();
        await profile.openDeleteAccountDialog();
        await expect(profile.deleteAccountDialog("Close your deployments first")).toContainText("You have 1 active deployment");
      });

      await test.step("the user closes the deployment", async () => {
        const response = await page.request.delete(`${API_URL}/v1/deployments/${deletedAccount.dseq}`);
        expect(response.status()).toBe(200);
        activeDseq = undefined;
      });

      const link = await test.step("requesting deletion sends the confirmation email", async () => {
        return await requestDeletionEmail(page, inbox, email);
      });

      await test.step("the link from the email deletes the account and signs the user out", async () => {
        await confirmDeletion(page, link);
      });

      await test.step("the deleted account's sign-in is removed", async () => {
        await expect.poll(() => auth0.getUserByEmail(email), { timeout: AUTH0_PURGE_DEADLINE_MS, intervals: POLL_INTERVALS_MS }).toBeNull();
      });

      await test.step("signing in again with the same email starts a fresh account", async () => {
        await signUpAndSkipOnboarding(page, email);

        expect(await waitForWalletAddress(page.request), "the fresh account gets a wallet of its own, without the deleted credits").not.toBe(
          deletedAccount.walletAddress
        );
        expect(await listDeploymentDseqs(page.request, "active")).toEqual([]);
        expect(await listDeploymentDseqs(page.request, "closed"), "the deleted account's closed deployment is not listed").toEqual([]);
        await apiKeys.goto();
        await expect(apiKeys.emptyNotice()).toBeVisible();
      });

      await test.step("the fresh account is deleted the same way", async () => {
        await confirmDeletion(page, await requestDeletionEmail(page, inbox, email));
      });
    } finally {
      if (activeDseq) await page.request.delete(`${API_URL}/v1/deployments/${activeDseq}`).catch(() => undefined);
      await deleteAuth0User(auth0, email);
    }
  });
});

/** Only a new account is sent to onboarding, so landing there again also tells a fresh account from a restored one. */
async function signUpAndSkipOnboarding(page: Page, email: string) {
  const picker = new OnboardingPickerPage(page);
  await page.goto(`${testEnvConfig.BASE_URL}/login`);
  await signInPasswordless(page, email);
  await acceptFairUsePolicyIfPrompted(page);
  await expect(picker.getHeading()).toBeVisible();
  await picker.skipOnboarding();
  await page.waitForURL(url => url.pathname !== "/onboarding");
}

async function requestDeletionEmail(page: Page, inbox: InboxClient, email: string): Promise<string> {
  const profile = new ProfilePage(page);
  await profile.goto();
  await profile.openDeleteAccountDialog();
  const requestedAtMs = Date.now();
  await profile.sendDeletionEmail(email);
  await expect(profile.deleteAccountDialog("Check your email")).toBeVisible();

  const message = await waitForEmail(inbox, { email, subject: DELETION_EMAIL_SUBJECT, receivedAfterMs: requestedAtMs });
  const deleteLink = message.links?.find(link => link.text === "Delete my account");
  expect(deleteLink, `the deletion email to ${email} carries no "Delete my account" link`).toBeDefined();

  return (deleteLink as { href: string }).href;
}

async function confirmDeletion(page: Page, link: string) {
  const confirmPage = new ConfirmAccountDeletionPage(page);
  await confirmPage.goto(link);
  await confirmPage.deleteAccount();
  await expect(page.getByText("Thanks for using Akash Console.")).toBeVisible({ timeout: 60_000 });
  expect((await page.request.get(`${API_URL}/v1/user/me`)).status()).toBe(401);
}

async function createDeployment(request: APIRequestContext): Promise<string> {
  let response: APIResponse | undefined;
  await expect
    .poll(
      async () => {
        response = await request.post(`${API_URL}/v1/deployments`, { data: { data: { sdl: SDL } } });
        return response.status();
      },
      { timeout: WALLET_PROVISIONING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .not.toBe(409);
  expect(response?.status(), await response?.text()).toBe(201);

  return ((await response?.json()) as { data: { dseq: string } }).data.dseq;
}

async function waitForWalletAddress(request: APIRequestContext): Promise<string> {
  const { data: user } = (await (await request.get(`${API_URL}/v1/user/me`)).json()) as { data: { id: string } };
  let address: string | undefined;
  await expect
    .poll(
      async () => {
        const wallets = (await (await request.get(`${API_URL}/v1/wallets?userId=${user.id}`)).json()) as { data?: { address: string }[] };
        address = wallets.data?.[0]?.address;
        return address;
      },
      { timeout: WALLET_PROVISIONING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBeTruthy();

  return address as string;
}

async function listDeploymentDseqs(request: APIRequestContext, state: "active" | "closed"): Promise<string[]> {
  const response = await request.get(`${API_URL}/v1/deployments?state=${state}`);
  expect(response.status()).toBe(200);

  return ((await response.json()) as DeploymentList).data.deployments.map(({ deployment }) => deployment.id.dseq);
}

async function deleteAuth0User(auth0: Auth0ManagementService, email: string) {
  const user = await auth0.getUserByEmail(email).catch(() => undefined);
  if (user) await auth0.deleteUser(user.user_id).catch(() => undefined);
}
