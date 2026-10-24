import type { APIRequestContext, APIResponse, Page, PlaywrightWorkerArgs } from "@playwright/test";

import { acceptFairUsePolicyIfPrompted } from "../actions/fair-use-policy";
import {
  createApiKey,
  createNames,
  createProjects,
  deleteAuth0UserQuietly,
  deleteTeam,
  deleteTeamsLeftBehind,
  joinTeamByInvite,
  listProjects,
  openApiKeyClient,
  PROXY_API_URL
} from "../actions/organization";
import { buyMinimumCredits, createTeam, TEST_CARD_LAST4 } from "../actions/team";
import { expect, openSignedOutPage, test } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { AlertsPage } from "../pages/AlertsPage";
import { BillingPage } from "../pages/BillingPage";
import { ConfigureDeploymentPage } from "../pages/ConfigureDeploymentPage";
import { ConfirmAccountDeletionPage } from "../pages/ConfirmAccountDeletionPage";
import { DeploymentAlertsForm } from "../pages/DeploymentAlertsForm";
import { DeploymentDetailPage } from "../pages/DeploymentDetailPage";
import { DeploymentListPage } from "../pages/DeploymentListPage";
import { NotificationChannelsPage } from "../pages/NotificationChannelsPage";
import { OnboardingPickerPage } from "../pages/OnboardingPickerPage";
import { OrganizationSettingsPage } from "../pages/OrganizationSettingsPage";
import { OrganizationSwitcher } from "../pages/OrganizationSwitcher";
import { ProfilePage } from "../pages/ProfilePage";
import { ProjectPage } from "../pages/ProjectPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { createInboxClient } from "../services/email-verification";
import type { InboxClient } from "../services/email-verification/inbox-client";
import { waitForEmail } from "../services/inbox-email";

const DELETION_EMAIL_SUBJECT = "Confirm your Akash Console account deletion";

/** Every team is created with this project, which a deployment started outside any project is asked to pick. */
const DEFAULT_PROJECT_NAME = "default-project";

/** A new account's trial wallet comes from a queued job, and a team's first purchase reaches its wallet only after the payment confirms. */
const WALLET_PROVISIONING_DEADLINE_MS = 3 * 60_000;

/** The api answers 409 while a trial wallet is still being created and 402 until a purchase has funded the wallet. */
const WALLET_NOT_READY_STATUSES = [409, 402];

/** The close alert of a leased deployment is filed by a queued job once the lease lands. */
const DEFAULT_ALERT_DEADLINE_MS = 2 * 60_000;

const BIDS_DEADLINE_MS = 2 * 60_000;

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

type CreatedDeployment = { data: { dseq: string; manifest: string } };

type DeploymentList = { data: { deployments: { deployment: { id: { dseq: string } } }[] } };

type DeploymentDetail = { data: { deployment: { id: { dseq: string } } } };

type AlertList = { data: { id: string; enabled: boolean; notificationChannelId: string }[] };

type DeploymentAlerts = { data: { alerts: { deploymentClosed?: { id: string; enabled: boolean; notificationChannelId: string } } } };

type WalletList = { data: { address: string | null; isTrialing: boolean; trialEndsAt: string | null; creditAmount: number }[] };

type TransactionList = { data: { transactions: { cardLast4?: string | null; initiatedBy?: { id: string } | null }[] } };

type BidList = { data: { bid: { id: { dseq: string; gseq: number; oseq: number; provider: string } } }[] };

type DeletionEligibility = { data: { teamsToTransfer: { name: string }[] } };

type CurrentUser = { data: { id: string; username?: string; email: string } };

test.describe("Alerts on team deployments", () => {
  test.use({ userType: "new" });
  test.setTimeout(15 * 60_000);

  test("a project member reads the close alert the owner set on a team deployment, a viewer cannot change it, and the owner's personal account does not list it", async ({
    page,
    browser,
    auth0
  }) => {
    const { suffix, team, sharedProject: project, deployment } = createNames();
    const channel = `e2e-oncall-${suffix}`;
    const inbox = createInboxClient();
    const memberEmail = inbox.generateEmail();
    const viewerEmail = inbox.generateEmail();
    const memberPage = await openSignedOutPage(browser);
    const viewerPage = await openSignedOutPage(browser);
    const switcher = new OrganizationSwitcher(page);
    const alertsForm = new DeploymentAlertsForm(page);
    const channelDialog = new NotificationChannelsPage(page);
    const ownerAlerts = new AlertsPage(page);
    const memberAlerts = new AlertsPage(memberPage);
    const viewerAlerts = new AlertsPage(viewerPage);
    const deploymentDetail = new DeploymentDetailPage(page);
    const picker = new OnboardingPickerPage(page);

    try {
      await test.step("the owner skips onboarding, so their personal account opens its pages, then creates a team, funds it and adds a project", async () => {
        await picker.goto();
        await picker.skipOnboarding();
        await page.waitForURL(url => url.pathname !== "/onboarding");
        await createTeam(page, team);
        await buyMinimumCredits(page);
        await createProjects(page, [project]);
      });

      await test.step("a member and a viewer of the project join the team", async () => {
        await joinTeamByInvite({ ownerPage: page, teammatePage: memberPage, team, email: memberEmail, projectName: project });
        await joinTeamByInvite({ ownerPage: page, teammatePage: viewerPage, team, email: viewerEmail, projectName: project, role: "Viewer" });
      });

      const dseq = await test.step("the owner deploys into the project", async () => {
        return await deployIntoProject(page, { project, deployment });
      });

      await test.step("the team files the deployment's default close alert", async () => {
        await waitForEnabledCloseAlert(page.request, `${PROXY_API_URL}/v1/deployment-alerts/${dseq}`);
      });

      await test.step("the owner points the close alert at a new channel from the deployment's settings", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/deployments/${dseq}`);
        await deploymentDetail.openAlerts();
        await alertsForm.openAddNotificationChannel();
        await channelDialog.fillForm({ name: channel, emails: inbox.generateEmail() });
        await channelDialog.submitForm();
        await expect(channelDialog.getChannelDialog()).toBeHidden({ timeout: 10_000 });
        await alertsForm.selectCloseChannel(channel);
        await alertsForm.getCloseEnabledToggle().check();
        await alertsForm.saveChanges();
        await expect(alertsForm.getCloseChannelSelect()).toContainText(channel);
      });

      await test.step("the project member finds the alert among the team's alerts and reads it on the deployment", async () => {
        const memberAlertsForm = new DeploymentAlertsForm(memberPage);
        await memberAlerts.goto();
        await acceptFairUsePolicyIfPrompted(memberPage, { settledBy: memberAlerts.loadedAlertList() });
        const row = await memberAlerts.findAlertRowByDseq(dseq);
        await expect(row).toContainText(channel);
        await expect(memberAlerts.getAlertToggle(row)).toBeChecked();

        await memberPage.goto(`${testEnvConfig.BASE_URL}/deployments/${dseq}`);
        await new DeploymentDetailPage(memberPage).openAlerts();
        await expect(memberAlertsForm.getCloseEnabledToggle()).toBeChecked();
        await expect(memberAlertsForm.getCloseChannelSelect()).toContainText(channel);
      });

      await test.step("the viewer reads the alert but cannot turn it off", async () => {
        await viewerAlerts.goto();
        await acceptFairUsePolicyIfPrompted(viewerPage, { settledBy: viewerAlerts.loadedAlertList() });
        const row = await viewerAlerts.findAlertRowByDseq(dseq);
        await expect(row).toContainText(channel);
        await expect(viewerAlerts.getAlertToggle(row)).toBeChecked();
        await viewerAlerts.getAlertToggle(row).click();
        await expect(viewerPage.getByText("Failed to update alert")).toBeVisible();

        await viewerPage.reload();
        await expect(viewerAlerts.getAlertToggle(await viewerAlerts.findAlertRowByDseq(dseq))).toBeChecked();
      });

      await test.step("the owner's personal account does not list the team's alert", async () => {
        await switcher.switchToPersonal();
        await expect(switcher.trigger(team)).toBeHidden({ timeout: 30_000 });
        await ownerAlerts.goto();
        await expect(ownerAlerts.loadedAlertList()).toBeVisible({ timeout: 30_000 });
        await expect(ownerAlerts.alertRowsOf(dseq)).toHaveCount(0);
      });

      await test.step("the owner closes the deployment back in the team", async () => {
        await switcher.switchTo(team);
        await expect(switcher.trigger(team)).toBeVisible({ timeout: 30_000 });
        await page.goto(`${testEnvConfig.BASE_URL}/deployments/${dseq}`);
        await deploymentDetail.closeDeployment();
        await deploymentDetail.expectClosed();
      });

      await test.step("the owner deletes the team", async () => {
        await deleteTeam(page, team);
      });
    } finally {
      await deleteTeamsLeftBehind(page);
      await memberPage.context().close();
      await viewerPage.context().close();
      await deleteAuth0UserQuietly(auth0, memberEmail);
      await deleteAuth0UserQuietly(auth0, viewerEmail);
    }
  });

  test("through API keys, the team's keys read the close alert set on a team deployment, a viewer's key cannot change it, and a personal key does not list it", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { suffix, team, sharedProject: project, deployment } = createNames();
    const inbox = createInboxClient();
    const memberEmail = inbox.generateEmail();
    const viewerEmail = inbox.generateEmail();
    const memberPage = await openSignedOutPage(browser);
    const viewerPage = await openSignedOutPage(browser);
    const keyClients: APIRequestContext[] = [];
    const openKeyClient = async (request: APIRequestContext, name: string) => {
      const client = await createKeyClient(playwright, request, name);
      keyClients.push(client);
      return client;
    };
    let ownerApi: APIRequestContext | undefined;
    let activeDseq: string | undefined;

    try {
      const personalApi = await test.step("the owner creates a key in their personal account", async () => {
        return await openKeyClient(page.request, `e2e-personal-${suffix}`);
      });

      await test.step("the owner creates a team, funds it and adds a project", async () => {
        await createTeam(page, team);
        await buyMinimumCredits(page);
        await createProjects(page, [project]);
      });

      await test.step("a member and a viewer of the project join the team", async () => {
        await joinTeamByInvite({ ownerPage: page, teammatePage: memberPage, team, email: memberEmail, projectName: project });
        await joinTeamByInvite({ ownerPage: page, teammatePage: viewerPage, team, email: viewerEmail, projectName: project, role: "Viewer" });
      });

      const { teamApi, memberApi, viewerApi } = await test.step("the owner, the member and the viewer each create a key in the team", async () => {
        return {
          teamApi: await openKeyClient(page.request, `e2e-owner-${suffix}`),
          memberApi: await openKeyClient(memberPage.request, `e2e-member-${suffix}`),
          viewerApi: await openKeyClient(viewerPage.request, `e2e-viewer-${suffix}`)
        };
      });
      ownerApi = teamApi;

      const dseq = await test.step("the owner's team key deploys into the project", async () => {
        const projectId = (await listProjects(teamApi, "v1/projects")).data.find(candidate => candidate.name === project)?.id;
        expect(projectId).toBeTruthy();
        activeDseq = (await createDeployment(teamApi, "v1/deployments", { name: deployment, projectId })).dseq;

        return activeDseq;
      });

      const { alertId, channelId } = await test.step("the owner's team key sets the deployment's close alert on a new team channel", async () => {
        const channelResponse = await teamApi.post("v1/notification-channels", {
          data: { data: { name: `e2e-oncall-${suffix}`, type: "email", config: { addresses: [inbox.generateEmail()] } } }
        });
        expect(channelResponse.status(), await channelResponse.text()).toBe(201);
        const createdChannelId = ((await channelResponse.json()) as { data: { id: string } }).data.id;

        const response = await upsertCloseAlert(teamApi, dseq, { notificationChannelId: createdChannelId, enabled: true });
        expect(response.status(), await response.text()).toBe(201);
        const { deploymentClosed } = ((await response.json()) as DeploymentAlerts).data.alerts;
        expect(deploymentClosed).toMatchObject({ notificationChannelId: createdChannelId, enabled: true });

        return { alertId: deploymentClosed?.id as string, channelId: createdChannelId };
      });

      await test.step("the owner's team key lists the alert", async () => {
        expect((await listAlertsOf(teamApi, dseq)).map(alert => alert.id)).toEqual([alertId]);
      });

      await test.step("the member's key lists the alert and reads it on the deployment", async () => {
        expect((await listAlertsOf(memberApi, dseq)).map(alert => alert.id)).toEqual([alertId]);
        expect(await readCloseAlert(memberApi, dseq)).toMatchObject({ id: alertId, notificationChannelId: channelId, enabled: true });
      });

      await test.step("the viewer's key reads the alert but cannot turn it off, delete it or replace it", async () => {
        const read = await viewerApi.get(`v1/alerts/${alertId}`);
        expect(read.status(), await read.text()).toBe(200);

        const update = await viewerApi.patch(`v1/alerts/${alertId}`, { data: { data: { enabled: false } } });
        const removal = await viewerApi.delete(`v1/alerts/${alertId}`);
        const replacement = await upsertCloseAlert(viewerApi, dseq, { notificationChannelId: channelId, enabled: false });
        expect([update.status(), removal.status(), replacement.status()]).toEqual([403, 403, 403]);
        expect(await readCloseAlert(teamApi, dseq)).toMatchObject({ id: alertId, enabled: true });
      });

      await test.step("the owner's personal key lists no alert of the team's deployment", async () => {
        expect(await listAlertsOf(personalApi, dseq)).toEqual([]);
        expect(await readCloseAlert(personalApi, dseq)).toBeUndefined();
      });

      await test.step("the owner's team key closes the deployment", async () => {
        const response = await teamApi.delete(`v1/deployments/${dseq}`);
        expect(response.status(), await response.text()).toBe(200);
        activeDseq = undefined;
      });

      await test.step("the owner deletes the team", async () => {
        await deleteTeam(page, team);
      });
    } finally {
      if (activeDseq)
        await closeDeploymentQuietly(ownerApi ?? page.request, ownerApi ? `v1/deployments/${activeDseq}` : `${PROXY_API_URL}/v1/deployments/${activeDseq}`);
      for (const client of keyClients) await client.dispose();
      await deleteTeamsLeftBehind(page);
      await memberPage.context().close();
      await viewerPage.context().close();
      await deleteAuth0UserQuietly(auth0, memberEmail);
      await deleteAuth0UserQuietly(auth0, viewerEmail);
    }
  });
});

test.describe("A teammate deleting their account", () => {
  test.use({ userType: "new" });
  test.setTimeout(12 * 60_000);

  test("the team keeps a deleted teammate's payment and deployment under a deleted account, and refuses its last owner's deletion while the teammate is in it", async ({
    page,
    browser,
    auth0
  }) => {
    const { team, deployment } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const settings = new OrganizationSettingsPage(page);
    const teammateSettings = new OrganizationSettingsPage(teammatePage);
    const profile = new ProfilePage(page);
    const billing = new BillingPage(page);
    const deployments = new DeploymentListPage(page);
    const projects = new ProjectsPage(page);
    let activeDseq: string | undefined;

    try {
      await test.step("the owner creates a team and the teammate joins it", async () => {
        await createTeam(page, team);
        await joinTeamByInvite({ ownerPage: page, teammatePage, team, email: teammateEmail });
        await teammateSettings.goto();
        await acceptFairUsePolicyIfPrompted(teammatePage, { settledBy: teammateSettings.heading() });
      });

      await test.step("the owner, the team's last owner while the teammate belongs to it, is refused deletion", async () => {
        await profile.goto();
        await profile.openDeleteAccountDialog();
        await expect(profile.deleteAccountDialog("Hand over your teams first").getByRole("listitem")).toHaveText([team]);
      });

      const ownerName = await displayNameOf(page.request);
      const teammateName = await displayNameOf(teammatePage.request);

      await test.step("the owner hands the team over to the teammate, who pays for it and deploys in it", async () => {
        await settings.goto();
        await settings.transferOwnership(teammateName);
        await expect(settings.ownerNotice({ ownerName: teammateName, organizationName: team })).toBeVisible();
        await buyMinimumCredits(teammatePage);
        activeDseq = (await createDeployment(teammatePage.request, `${PROXY_API_URL}/v1/deployments`, { name: deployment })).dseq;
      });

      await test.step("the teammate hands the team back and deletes their account from the emailed link", async () => {
        await teammateSettings.goto();
        await teammateSettings.transferOwnership(ownerName);
        await expect(teammateSettings.ownerNotice({ ownerName, organizationName: team })).toBeVisible();
        await confirmDeletion(teammatePage, await requestDeletionEmail(teammatePage, inbox, teammateEmail));
      });

      await test.step("the team's payment export credits the teammate's payment to a deleted account", async () => {
        await billing.goto();
        await expect(billing.cardPayment(TEST_CARD_LAST4)).toBeVisible();

        const cardPayments = readCsvRecords(await billing.exportPaymentHistoryCsv()).filter(record => record["Card Last 4"] === TEST_CARD_LAST4);
        expect(cardPayments.map(record => record["Initiated By"])).toEqual(["Deleted account"]);
      });

      await test.step("the team keeps the teammate's deployment, which its activity credits to a deleted account", async () => {
        await deployments.goto();
        await expect(deployments.listedDeployment(deployment)).toBeVisible();
        await projects.goto();
        await expect(projects.deploymentActivity(deployment)).toContainText(`Deleted account deployed ${deployment}`, { timeout: 30_000 });
      });

      await test.step("the owner closes the deployment", async () => {
        const response = await page.request.delete(`${PROXY_API_URL}/v1/deployments/${activeDseq}`);
        expect(response.status(), await response.text()).toBe(200);
        activeDseq = undefined;
      });

      await test.step("the team's payment history credits the teammate's payment to a deleted account", async () => {
        await billing.goto();
        await expect(billing.cardPayment(TEST_CARD_LAST4)).toContainText("Deleted account");
      });

      await test.step("the owner deletes the team", async () => {
        await deleteTeam(page, team);
      });
    } finally {
      if (activeDseq) {
        await closeDeploymentQuietly(page.request, `${PROXY_API_URL}/v1/deployments/${activeDseq}`);
        await closeDeploymentQuietly(teammatePage.request, `${PROXY_API_URL}/v1/deployments/${activeDseq}`);
      }
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(teammatePage);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });

  test("through API keys, a deleted teammate's key stops working, the owner's team key still returns their payment and deployment, and no key can start an account deletion", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { suffix, team, deployment } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const settings = new OrganizationSettingsPage(page);
    const teammateSettings = new OrganizationSettingsPage(teammatePage);
    const keyClients: APIRequestContext[] = [];
    const openKeyClient = async (request: APIRequestContext, name: string) => {
      const client = await createKeyClient(playwright, request, name);
      keyClients.push(client);
      return client;
    };
    let ownerApi: APIRequestContext | undefined;
    let activeDseq: string | undefined;

    try {
      await test.step("the owner creates a team and the teammate joins it", async () => {
        await createTeam(page, team);
        await joinTeamByInvite({ ownerPage: page, teammatePage, team, email: teammateEmail });
        await teammateSettings.goto();
        await acceptFairUsePolicyIfPrompted(teammatePage, { settledBy: teammateSettings.heading() });
      });

      const teamApi = await test.step("the owner creates a team key", async () => {
        return await openKeyClient(page.request, `e2e-owner-${suffix}`);
      });
      ownerApi = teamApi;

      await test.step("the owner's key cannot check or start an account deletion, and the owner's session is refused as the team's last owner", async () => {
        await expectSessionRequired(teamApi.get("v1/user/me/deletion-eligibility"));
        await expectSessionRequired(teamApi.post("v1/user/me/initiate-deletion", { data: { data: { forfeitAcknowledged: true } } }));

        const eligibility = await page.request.get(`${PROXY_API_URL}/v1/user/me/deletion-eligibility`);
        expect(eligibility.status(), await eligibility.text()).toBe(200);
        expect(((await eligibility.json()) as DeletionEligibility).data.teamsToTransfer.map(({ name }) => name)).toEqual([team]);

        const initiate = await page.request.post(`${PROXY_API_URL}/v1/user/me/initiate-deletion`, { data: { data: { forfeitAcknowledged: true } } });
        expect(initiate.status(), await initiate.text()).toBe(409);
        expect(await initiate.json()).toMatchObject({ code: "last_owner" });
      });

      const ownerName = await displayNameOf(page.request);
      const teammateName = await displayNameOf(teammatePage.request);

      const teammateApi = await test.step("the owner hands the team over to the teammate, who pays for it and deploys in it with a team key", async () => {
        await settings.goto();
        await settings.transferOwnership(teammateName);
        await expect(settings.ownerNotice({ ownerName: teammateName, organizationName: team })).toBeVisible();
        await buyMinimumCredits(teammatePage);
        const client = await openKeyClient(teammatePage.request, `e2e-teammate-${suffix}`);
        activeDseq = (await createDeployment(client, "v1/deployments", { name: deployment })).dseq;

        return client;
      });
      const dseq = activeDseq as string;

      await test.step("the teammate's key cannot start their account deletion either", async () => {
        await expectSessionRequired(teammateApi.post("v1/user/me/initiate-deletion", { data: { data: { forfeitAcknowledged: true } } }));
      });

      await test.step("the teammate hands the team back and deletes their account from a signed-in session", async () => {
        await teammateSettings.goto();
        await teammateSettings.transferOwnership(ownerName);
        await expect(teammateSettings.ownerNotice({ ownerName, organizationName: team })).toBeVisible();
        await confirmDeletion(teammatePage, await requestDeletionEmail(teammatePage, inbox, teammateEmail));
      });

      await test.step("the teammate's key stops working", async () => {
        expect((await teammateApi.get("v1/user/me")).status()).toBe(401);
        expect((await teammateApi.get(`v1/deployments/${dseq}`)).status()).toBe(401);
      });

      await test.step("the owner's team key still returns the teammate's payment, credited to no one, and their deployment", async () => {
        const transactions = await teamApi.get("v1/stripe/transactions");
        expect(transactions.status(), await transactions.text()).toBe(200);
        const cardPayments = ((await transactions.json()) as TransactionList).data.transactions.filter(
          transaction => transaction.cardLast4 === TEST_CARD_LAST4
        );
        expect(cardPayments).toEqual([expect.objectContaining({ initiatedBy: null })]);

        const deploymentResponse = await teamApi.get(`v1/deployments/${dseq}`);
        expect(deploymentResponse.status(), await deploymentResponse.text()).toBe(200);
        expect(((await deploymentResponse.json()) as DeploymentDetail).data.deployment.id.dseq).toBe(dseq);
      });

      await test.step("the owner's team key closes the deployment", async () => {
        const response = await teamApi.delete(`v1/deployments/${dseq}`);
        expect(response.status(), await response.text()).toBe(200);
        activeDseq = undefined;
      });

      await test.step("the owner deletes the team", async () => {
        await deleteTeam(page, team);
      });
    } finally {
      if (activeDseq)
        await closeDeploymentQuietly(ownerApi ?? page.request, ownerApi ? `v1/deployments/${activeDseq}` : `${PROXY_API_URL}/v1/deployments/${activeDseq}`);
      for (const client of keyClients) await client.dispose();
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(teammatePage);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });
});

test.describe("The personal account and the trial", () => {
  test.use({ userType: "new" });
  test.setTimeout(12 * 60_000);

  test("a new user's personal account deploys on its trial as before, while a team they create has no trial and asks for funds before deploying", async ({
    page
  }) => {
    const { team } = createNames();
    const picker = new OnboardingPickerPage(page);
    const configure = new ConfigureDeploymentPage(page);
    const deploymentDetail = new DeploymentDetailPage(page);
    const billing = new BillingPage(page);
    const projects = new ProjectsPage(page);

    try {
      await test.step("the new user's personal account shows a free trial", async () => {
        await billing.goto();
        await expect(billing.trialPanel()).toContainText(/\d+ days? left out of \d+ days before the trial ends/, { timeout: WALLET_PROVISIONING_DEADLINE_MS });
      });

      await test.step("the user deploys their own image from onboarding on the trial", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/`, { waitUntil: "commit" });
        await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
        await picker.deployImage();
        await configure.fillImageName("nginx:latest");
        await configure.requestQuotes();
        await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 180_000 });
        const dseq = new URL(page.url()).pathname.match(/\/new-deployment\/configure\/(\d+)/)?.[1];
        expect(dseq).toBeTruthy();

        await configure.selectFirstAvailableProvider();
        await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
        await configure.confirmAndOpenDeployment(dseq as string);
        await page.waitForURL(new RegExp(`/deployments/${dseq}(?:[/?]|$)`), { timeout: 30_000 });
      });

      await test.step("the user closes the trial deployment", async () => {
        await deploymentDetail.closeDeployment();
        await deploymentDetail.expectClosed();
      });

      await test.step("a team the user creates shows no free trial", async () => {
        await createTeam(page, team);
        await billing.goto();
        await expect(billing.emptyPaymentHistoryNotice()).toBeVisible({ timeout: 30_000 });
        await expect(billing.trialPanel()).toBeHidden();
      });

      await test.step("the team asks for a payment method, and deploying in it before it is funded asks for funds and creates nothing", async () => {
        await expect(page.getByRole("status").filter({ hasText: `${team} has no payment method.` })).toContainText("Add one so your team can deploy.");
        await projects.goto();
        await projects.openProject(DEFAULT_PROJECT_NAME);
        await new ProjectPage(page).startNewDeployment();
        await configure.continueWithOwnContainer();
        await configure.fillImageName("nginx:latest");
        await configure.requestQuotes();
        await expect(page.getByText("Add funds to continue")).toBeVisible({ timeout: 60_000 });
        expect(await listActiveDseqs(page.request, `${PROXY_API_URL}/v1/deployments`)).toEqual([]);
      });

      await test.step("the user deletes the team", async () => {
        await deleteTeam(page, team);
      });
    } finally {
      await deleteTeamsLeftBehind(page);
    }
  });

  test("through API keys, a personal key deploys on the trial as before, while a team key sees no trial and is asked to pay before the team is funded", async ({
    page,
    playwright
  }) => {
    const { suffix, team, deployment } = createNames();
    const keyClients: APIRequestContext[] = [];
    const openKeyClient = async (request: APIRequestContext, name: string) => {
      const client = await createKeyClient(playwright, request, name);
      keyClients.push(client);
      return client;
    };
    let personalKeyApi: APIRequestContext | undefined;
    let activeDseq: string | undefined;

    try {
      const personalApi = await test.step("the new user creates a key in their personal account", async () => {
        return await openKeyClient(page.request, `e2e-personal-${suffix}`);
      });
      personalKeyApi = personalApi;
      const userId = await currentUserIdOf(personalApi);

      const personalWallet = await test.step("the personal key sees the account's wallet on a free trial", async () => {
        return await waitForTrialWallet(personalApi, userId);
      });

      await test.step("the personal key deploys on the trial and leases the deployment", async () => {
        const created = await createDeployment(personalApi, "v1/deployments", { name: deployment });
        activeDseq = created.dseq;
        await leaseFirstBid(personalApi, created);
      });

      await test.step("the personal key closes the deployment", async () => {
        const response = await personalApi.delete(`v1/deployments/${activeDseq}`);
        expect(response.status(), await response.text()).toBe(200);
        activeDseq = undefined;
      });

      const teamApi = await test.step("the user creates a team and a key in it", async () => {
        await createTeam(page, team);
        return await openKeyClient(page.request, `e2e-team-${suffix}`);
      });

      await test.step("the team key sees the team's own wallet, with no trial", async () => {
        const wallets = await listWallets(teamApi, userId);
        expect(wallets).toEqual([expect.objectContaining({ isTrialing: false, trialEndsAt: null, creditAmount: 0 })]);
        expect(wallets[0].address).not.toBe(personalWallet.address);
      });

      await test.step("the team key is asked to pay when it deploys before the team is funded, and creates nothing", async () => {
        const response = await teamApi.post("v1/deployments", { data: { data: { sdl: SDL, name: deployment } } });
        expect(response.status(), await response.text()).toBe(402);
        expect(await listActiveDseqs(teamApi, "v1/deployments")).toEqual([]);
      });

      await test.step("the personal key still sees the trial", async () => {
        expect(await listWallets(personalApi, userId)).toEqual([expect.objectContaining({ address: personalWallet.address, isTrialing: true })]);
      });

      await test.step("the user deletes the team", async () => {
        await deleteTeam(page, team);
      });
    } finally {
      if (activeDseq && personalKeyApi) await closeDeploymentQuietly(personalKeyApi, `v1/deployments/${activeDseq}`);
      for (const client of keyClients) await client.dispose();
      await deleteTeamsLeftBehind(page);
    }
  });
});

async function createKeyClient(playwright: PlaywrightWorkerArgs["playwright"], request: APIRequestContext, name: string) {
  const { apiKey } = await createApiKey(request, { name });

  return await openApiKeyClient(playwright, apiKey);
}

/** Starts from the project's own page, which carries the project into the new deployment. */
async function deployIntoProject(page: Page, input: { project: string; deployment: string }): Promise<string> {
  const projects = new ProjectsPage(page);
  const configure = new ConfigureDeploymentPage(page);

  await projects.goto();
  await projects.openProject(input.project);
  await new ProjectPage(page).startNewDeployment();
  await configure.continueWithOwnContainer();
  await expect(configure.deployTarget()).toContainText(input.project);
  await configure.fillDeploymentName(input.deployment);
  await configure.fillImageName("nginx:latest");
  await configure.requestQuotes();
  await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 90_000 });
  const dseq = new URL(page.url()).pathname.match(/\/new-deployment\/configure\/(\d+)/)?.[1];
  expect(dseq).toBeTruthy();

  await configure.selectFirstAvailableProvider();
  await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
  await configure.confirmAndOpenDeployment(dseq as string);

  return dseq as string;
}

async function createDeployment(request: APIRequestContext, url: string, input: { name?: string; projectId?: string }) {
  let response: APIResponse | undefined;
  await expect
    .poll(
      async () => {
        response = await request.post(url, { data: { data: { sdl: SDL, ...input } } });
        return WALLET_NOT_READY_STATUSES.includes(response.status());
      },
      { timeout: WALLET_PROVISIONING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBe(false);
  expect(response?.status(), await response?.text()).toBe(201);

  return ((await response?.json()) as CreatedDeployment).data;
}

async function leaseFirstBid(api: APIRequestContext, deployment: CreatedDeployment["data"]) {
  let bids: BidList["data"] = [];
  await expect
    .poll(
      async () => {
        const response = await api.get("v1/bids", { params: { dseq: deployment.dseq } });
        bids = response.ok() ? ((await response.json()) as BidList).data : [];
        return bids.length;
      },
      { timeout: BIDS_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBeGreaterThan(0);

  const { id } = bids[0].bid;
  const response = await api.post("v1/leases", {
    data: { leases: [{ dseq: id.dseq, gseq: id.gseq, oseq: id.oseq, provider: id.provider }], manifest: deployment.manifest }
  });
  expect([200, 202], await response.text()).toContain(response.status());
}

async function listActiveDseqs(request: APIRequestContext, url: string): Promise<string[]> {
  const response = await request.get(url);
  expect(response.status(), await response.text()).toBe(200);

  return ((await response.json()) as DeploymentList).data.deployments.map(({ deployment }) => deployment.id.dseq);
}

async function closeDeploymentQuietly(request: APIRequestContext, url: string) {
  await request.delete(url, { failOnStatusCode: false, timeout: 60_000 }).catch(() => undefined);
}

async function waitForEnabledCloseAlert(request: APIRequestContext, url: string) {
  await expect
    .poll(
      async () => {
        const response = await request.get(url);
        return response.ok() ? ((await response.json()) as DeploymentAlerts).data.alerts.deploymentClosed?.enabled : undefined;
      },
      { timeout: DEFAULT_ALERT_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBe(true);
}

async function upsertCloseAlert(api: APIRequestContext, dseq: string, deploymentClosed: { notificationChannelId: string; enabled: boolean }) {
  return await api.post(`v1/deployment-alerts/${dseq}`, { data: { data: { alerts: { deploymentClosed } } } });
}

async function listAlertsOf(api: APIRequestContext, dseq: string) {
  const response = await api.get("v1/alerts", { params: { dseq } });
  expect(response.status(), await response.text()).toBe(200);

  return ((await response.json()) as AlertList).data;
}

async function readCloseAlert(api: APIRequestContext, dseq: string) {
  const response = await api.get(`v1/deployment-alerts/${dseq}`);
  expect(response.status(), await response.text()).toBe(200);

  return ((await response.json()) as DeploymentAlerts).data.alerts.deploymentClosed;
}

async function currentUserIdOf(api: APIRequestContext): Promise<string> {
  const response = await api.get("v1/user/me");
  expect(response.status(), await response.text()).toBe(200);

  return ((await response.json()) as CurrentUser).data.id;
}

async function listWallets(api: APIRequestContext, userId: string) {
  const response = await api.get("v1/wallets", { params: { userId } });
  expect(response.status(), await response.text()).toBe(200);

  return ((await response.json()) as WalletList).data;
}

async function waitForTrialWallet(api: APIRequestContext, userId: string) {
  let wallets: WalletList["data"] = [];
  await expect
    .poll(
      async () => {
        wallets = await listWallets(api, userId);
        return wallets[0]?.address;
      },
      { timeout: WALLET_PROVISIONING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBeTruthy();
  expect(wallets).toEqual([expect.objectContaining({ isTrialing: true, trialEndsAt: expect.any(String) })]);

  return wallets[0];
}

async function expectSessionRequired(request: Promise<APIResponse>) {
  const response = await request;
  expect(response.status(), await response.text()).toBe(403);
  expect(await response.json()).toMatchObject({ code: "session_required" });
}

/** The name a team offers a member under, as when handing it over: their username, or their email when they have none. */
async function displayNameOf(request: APIRequestContext): Promise<string> {
  const { data: user } = (await (await request.get(`${PROXY_API_URL}/v1/user/me`)).json()) as CurrentUser;

  return user.username || user.email;
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
  expect((await page.request.get(`${PROXY_API_URL}/v1/user/me`)).status()).toBe(401);
}

function readCsvRecords(csv: string): Record<string, string>[] {
  const [header, ...rows] = csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map(line => line.split(CSV_FIELD_SEPARATOR).map(field => field.replace(/^"(.*)"$/s, "$1").replaceAll('""', '"')));

  return rows.map(row => Object.fromEntries(header.map((column, index) => [column, row[index]])));
}
