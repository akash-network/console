import type { APIRequestContext, APIResponse, Page } from "@playwright/test";

import { signInPasswordless } from "./actions/auth";
import { acceptFairUsePolicyIfPrompted } from "./actions/fair-use-policy";
import { buyMinimumCredits, createTeam, TEST_CARD_LAST4 } from "./actions/team";
import { expect, openSignedOutPage, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { BillingPage } from "./pages/BillingPage";
import { ConfirmAccountDeletionPage } from "./pages/ConfirmAccountDeletionPage";
import { DeploymentListPage } from "./pages/DeploymentListPage";
import { InvitationPage } from "./pages/InvitationPage";
import { MembersPage } from "./pages/MembersPage";
import { OnboardingPickerPage } from "./pages/OnboardingPickerPage";
import { OrganizationSettingsPage } from "./pages/OrganizationSettingsPage";
import { OrganizationSwitcher } from "./pages/OrganizationSwitcher";
import { ProfilePage } from "./pages/ProfilePage";
import type { Auth0ManagementService } from "./services/auth0-management.service";
import { createInboxClient } from "./services/email-verification";
import type { InboxClient } from "./services/email-verification/inbox-client";
import { waitForEmail } from "./services/inbox-email";

const API_URL = `${testEnvConfig.BASE_URL}/api/proxy`;

const DELETION_EMAIL_SUBJECT = "Confirm your Akash Console account deletion";

/** A new account's trial wallet comes from a queued job, and a team's first purchase reaches its wallet only after the payment confirms. */
const WALLET_PROVISIONING_DEADLINE_MS = 3 * 60_000;

/** The api answers 409 while a trial wallet is still being created and 402 until a purchase has funded the wallet. */
const WALLET_NOT_READY_STATUSES = [409, 402];

/** The deleted account's sign-in is removed from Auth0 by a queued job after the deletion commits. */
const AUTH0_PURGE_DEADLINE_MS = 3 * 60_000;

const POLL_INTERVALS_MS = [5_000];

/** Splits on the commas outside quotes, since the date and description columns may hold commas of their own. */
const CSV_FIELD_SEPARATOR = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;

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

test.describe("Account deletion in a team", () => {
  test.setTimeout(12 * 60_000);

  test("a teammate pays and deploys for a team, hands it back to delete their account, and the owner left alone deletes the team with theirs", async ({
    page,
    browser,
    auth0
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const team = `e2e-team-${suffix}`;
    const deploymentName = `e2e-deploy-${suffix}`;
    const inbox = createInboxClient();
    const ownerEmail = inbox.generateEmail();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const settings = new OrganizationSettingsPage(page);
    const teammateSettings = new OrganizationSettingsPage(teammatePage);
    const profile = new ProfilePage(page);
    const teammateProfile = new ProfilePage(teammatePage);
    const billing = new BillingPage(page);
    const deployments = new DeploymentListPage(page);
    let activeDseq: string | undefined;
    let isTeamDeleted = false;

    try {
      await test.step("the owner signs up and creates a team", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/login`);
        await signInPasswordless(page, ownerEmail);
        await acceptFairUsePolicyIfPrompted(page);
        await createTeam(page, team);
      });

      await test.step("the teammate signs up from an invite link and joins the team", async () => {
        const members = new MembersPage(page);
        const invitation = new InvitationPage(teammatePage);
        await members.inviteMember({ organizationName: team, email: teammateEmail });
        await expect(page.getByText(`Invite sent to ${teammateEmail}`)).toBeVisible();
        await invitation.goto(await members.copyInviteLink(teammateEmail));
        await invitation.signUpToAccept();
        await signInPasswordless(teammatePage, teammateEmail);
        await invitation.accept();
        await expect(new OrganizationSwitcher(teammatePage).trigger(team)).toBeVisible();
        await teammateSettings.goto();
        await acceptFairUsePolicyIfPrompted(teammatePage, { settledBy: teammateSettings.heading() });
      });

      const ownerName = await displayNameOf(page.request);
      const teammateName = await displayNameOf(teammatePage.request);

      await test.step("the owner hands the team over to the teammate, since only an owner pays for a team", async () => {
        await settings.goto();
        await settings.transferOwnership(teammateName);
        await expect(settings.ownerNotice({ ownerName: teammateName, organizationName: team })).toBeVisible();
      });

      await test.step("the teammate pays for the team and deploys in it", async () => {
        await buyMinimumCredits(teammatePage);
        activeDseq = await createDeployment(teammatePage.request, deploymentName);
      });

      await test.step("the teammate, now the team's last owner, is refused deletion", async () => {
        await teammateProfile.goto();
        await teammateProfile.openDeleteAccountDialog();
        await expect(teammateProfile.deleteAccountDialog("Hand over your teams first").getByRole("listitem")).toHaveText([team]);
      });

      await test.step("the teammate hands the team back and deletes their account", async () => {
        await teammateSettings.goto();
        await teammateSettings.transferOwnership(ownerName);
        await expect(teammateSettings.ownerNotice({ ownerName, organizationName: team })).toBeVisible();
        await confirmDeletion(teammatePage, await requestDeletionEmail(teammatePage, inbox, teammateEmail));
      });

      await test.step("the team keeps the teammate's payment, which its export credits to a deleted account", async () => {
        await billing.goto();
        await expect(billing.cardPayment(TEST_CARD_LAST4)).toBeVisible();

        const cardPayments = readCsvRecords(await billing.exportPaymentHistoryCsv()).filter(record => record["Card Last 4"] === TEST_CARD_LAST4);
        expect(cardPayments.map(record => record["Initiated By"])).toEqual(["Deleted account"]);
      });

      await test.step("the team keeps the teammate's deployment under its name", async () => {
        await deployments.goto();
        await expect(deployments.listedDeployment(deploymentName)).toBeVisible();
      });

      await test.step("the owner closes the deployment", async () => {
        const response = await page.request.delete(`${API_URL}/v1/deployments/${activeDseq}`);
        expect(response.status()).toBe(200);
        activeDseq = undefined;
      });

      await test.step("the owner, now the team's only member, deletes the team along with their account", async () => {
        await profile.goto();
        await profile.openDeleteAccountDialog();
        await expect(profile.forfeitCreditsDialog()).toContainText("This includes the credits of the teams deleted with your account.");
        await profile.forfeitCredits();

        const confirmStep = profile.deleteAccountDialog("Delete your account?");
        await expect(confirmStep).toContainText("You're the only member of these teams, so they're deleted with your account:");
        await expect(confirmStep.getByRole("listitem")).toHaveText([team]);
        const requestedAtMs = Date.now();
        await profile.sendDeletionEmail(ownerEmail, { acknowledgeForfeit: true });
        await expect(profile.deleteAccountDialog("Check your email")).toBeVisible();

        await confirmDeletion(page, await waitForDeletionLink(inbox, ownerEmail, requestedAtMs));
        isTeamDeleted = true;
      });
    } finally {
      if (activeDseq) {
        await closeDeploymentQuietly(page.request, activeDseq);
        await closeDeploymentQuietly(teammatePage.request, activeDseq);
      }
      if (!isTeamDeleted) {
        await deleteTeamQuietly(settings, team);
        await deleteTeamQuietly(teammateSettings, team);
      }
      await teammatePage.context().close();
      await deleteAuth0User(auth0, teammateEmail);
      await deleteAuth0User(auth0, ownerEmail);
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

  return await waitForDeletionLink(inbox, email, requestedAtMs);
}

async function waitForDeletionLink(inbox: InboxClient, email: string, requestedAtMs: number): Promise<string> {
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

async function createDeployment(request: APIRequestContext, name?: string): Promise<string> {
  let response: APIResponse | undefined;
  await expect
    .poll(
      async () => {
        response = await request.post(`${API_URL}/v1/deployments`, { data: { data: { sdl: SDL, name } } });
        return WALLET_NOT_READY_STATUSES.includes(response.status());
      },
      { timeout: WALLET_PROVISIONING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBe(false);
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

/** The name a team offers a member under, as when handing it over: their username, or their email when they have none. */
async function displayNameOf(request: APIRequestContext): Promise<string> {
  const { data: user } = (await (await request.get(`${API_URL}/v1/user/me`)).json()) as { data: { username?: string; email: string } };

  return user.username || user.email;
}

function readCsvRecords(csv: string): Record<string, string>[] {
  const [header, ...rows] = csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map(line => line.split(CSV_FIELD_SEPARATOR).map(field => field.replace(/^"(.*)"$/s, "$1").replaceAll('""', '"')));

  return rows.map(row => Object.fromEntries(header.map((column, index) => [column, row[index]])));
}

async function closeDeploymentQuietly(request: APIRequestContext, dseq: string) {
  await request.delete(`${API_URL}/v1/deployments/${dseq}`, { failOnStatusCode: false, timeout: 60_000 }).catch(() => undefined);
}

/** Only the team's owner gets past the first click, so trying from each member's page reaches whoever holds the team when a run breaks off. */
async function deleteTeamQuietly(settings: OrganizationSettingsPage, team: string) {
  await settings.goto().catch(() => undefined);
  await settings.deleteOrganization(team).catch(() => undefined);
}
