import type { APIRequestContext, Page } from "@playwright/test";

import { signInPasswordless } from "./actions/auth";
import { acceptFairUsePolicyIfPrompted } from "./actions/fair-use-policy";
import { expect, getUserAgent, openSignedOutPage, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { AddCreditsSheetPage } from "./pages/AddCreditsSheetPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { AppNav } from "./pages/AppNav";
import { BillingPage } from "./pages/BillingPage";
import { ConfigureDeploymentPage } from "./pages/ConfigureDeploymentPage";
import { InvitationPage } from "./pages/InvitationPage";
import { MembersPage } from "./pages/MembersPage";
import { OrganizationSwitcher } from "./pages/OrganizationSwitcher";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { createInboxClient } from "./services/email-verification";
import { waitForInvitationEmail } from "./services/invitation-inbox";

const STANDARD_TOP_UP_MIN_AMOUNT_USD = "20";

type ProjectList = { data: { id: string; name: string }[] };

type OrganizationList = { data: { id: string; name: string }[] };

test.describe("Team organizations", () => {
  test.use({ userType: "new" });
  test.setTimeout(8 * 60_000);

  test("an owner shares one project with an invited teammate, then removes them", async ({ page, browser, auth0 }) => {
    const { team, sharedProject, hiddenProject } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const members = new MembersPage(page);
    const teammateSwitcher = new OrganizationSwitcher(teammatePage);
    const teammateProjects = new ProjectsPage(teammatePage);
    const invitation = new InvitationPage(teammatePage);

    try {
      await test.step("the owner creates a team and lands in it instead of onboarding", async () => {
        await createTeam(page, team);
      });

      await test.step("the owner creates two projects", async () => {
        await createProjects(page, [sharedProject, hiddenProject]);
      });

      await test.step("the owner invites the teammate to one of them", async () => {
        await members.goto();
        await members.inviteMember({ organizationName: team, email: teammateEmail, projectName: sharedProject });
        await expect(page.getByText(`Invite sent to ${teammateEmail}`)).toBeVisible();
      });

      await test.step("the invitation email reaches the teammate", async () => {
        await waitForInvitationEmail(inbox, { email: teammateEmail, organizationName: team });
      });

      await test.step("the teammate signs up from the invite link and joins the team", async () => {
        const link = await members.copyInviteLink(teammateEmail);
        await invitation.goto(link);
        await expect(invitation.heading(team)).toBeVisible();
        await invitation.signUpToAccept();
        await signInPasswordless(teammatePage, teammateEmail);
        await invitation.accept();
        await expect(teammatePage.getByText(`You joined ${team}`)).toBeVisible();
        await expect(teammateSwitcher.trigger(team)).toBeVisible();
      });

      await test.step("the teammate sees only the project they were given", async () => {
        await teammateProjects.goto();
        await acceptFairUsePolicyIfPrompted(teammatePage, { settledBy: teammateProjects.heading() });
        await expect(teammateProjects.projectFolder(sharedProject)).toBeVisible();
        await expect(teammateProjects.projectFolder(hiddenProject)).toBeHidden();
      });

      await test.step("the teammate switches to their personal account and back through a link, which a reload keeps", async () => {
        await teammateSwitcher.switchToPersonal();
        await expect(teammateSwitcher.trigger()).toBeVisible();
        await expect(teammateSwitcher.trigger(team)).toBeHidden();

        await teammatePage.goto(`${testEnvConfig.BASE_URL}/projects?org=${team}`);
        await expect(teammateProjects.projectFolder(sharedProject)).toBeVisible();
        await teammatePage.reload();
        await expect(teammateSwitcher.trigger(team)).toBeVisible();
        await expect(teammateProjects.projectFolder(sharedProject)).toBeVisible();
      });

      await test.step("the owner removes the teammate, who loses access to the team", async () => {
        await members.goto();
        await members.removeMember(teammateEmail);
        await expect(members.memberRow(teammateEmail)).toBeHidden();

        const teamRequest = await teammatePage.request.get(`${testEnvConfig.BASE_URL}/api/proxy/v1/projects`);
        expect(teamRequest.status()).toBe(403);
      });
    } finally {
      await teammatePage.context().close();
      const teammate = await auth0.getUserByEmail(teammateEmail).catch(() => undefined);
      if (teammate) await auth0.deleteUser(teammate.user_id).catch(() => undefined);
    }
  });

  test("an API key bound to one project reaches only that project", async ({ page, playwright }) => {
    const { team, sharedProject, hiddenProject } = createNames();
    const keyName = `e2e-project-key-${Date.now()}`;
    const apiKeys = new ApiKeysPage(page);
    let api: APIRequestContext | undefined;

    try {
      await test.step("the owner creates a team with two projects", async () => {
        await createTeam(page, team);
        await createProjects(page, [sharedProject, hiddenProject]);
      });

      const secret = await test.step("the owner creates a key bound to one project", async () => {
        await new AppNav(page).openApiKeys();
        await apiKeys.waitForPage();
        await apiKeys.createKey(keyName, { projectName: sharedProject });
        await expect(apiKeys.getCreatedKeySecret(keyName)).not.toBeEmpty({ timeout: 10_000 });
        const keySecret = (await apiKeys.getCreatedKeySecret(keyName).textContent()) ?? "";
        await apiKeys.closeCreatedKeyDialog(keyName);

        return keySecret;
      });

      await test.step("the key lists and reads only its project, and cannot rename the team", async () => {
        const ownerProjects = await listProjects(page.request, `${testEnvConfig.BASE_URL}/api/proxy/v1/projects`);
        const hidden = ownerProjects.data.find(project => project.name === hiddenProject);
        expect(hidden).toBeDefined();
        api = await playwright.request.newContext({
          baseURL: `${testEnvConfig.BASE_URL}/api/proxy/`,
          extraHTTPHeaders: { "x-api-key": secret, "user-agent": getUserAgent() }
        });

        expect((await listProjects(api, "v1/projects")).data.map(project => project.name)).toEqual([sharedProject]);
        expect((await api.get(`v1/projects/${hidden?.id}`)).status()).toBe(404);

        const [keyOrganization] = ((await (await api.get("v1/organizations")).json()) as OrganizationList).data;
        expect(keyOrganization.name).toBe(team);
        const rename = await api.patch(`v1/organizations/${keyOrganization.id}`, { data: { data: { name: `${team}-renamed` } } });
        expect(rename.status()).toBe(403);
      });

      await test.step("the owner revokes the key", async () => {
        await apiKeys.revokeKey(keyName);
        await expect(apiKeys.getKeyRow(keyName)).toBeHidden({ timeout: 10_000 });
      });
    } finally {
      await api?.dispose();
    }
  });

  test("an owner funds the team, deploys into a project, then finds the deployment in it and in the team's activity", async ({ page }) => {
    const { team, sharedProject: project, deployment } = createNames();
    const projects = new ProjectsPage(page);
    const projectPage = new ProjectPage(page);
    const configure = new ConfigureDeploymentPage(page);
    let dseq: string | undefined;

    try {
      await test.step("the owner creates a team and buys it the smallest amount of credits with a card", async () => {
        await createTeam(page, team);
        await buyMinimumCredits(page);
      });

      await test.step("the owner starts a deployment from a new project, which the deployment is headed for", async () => {
        await createProjects(page, [project]);
        await projects.openProject(project);
        await expect(projectPage.heading(project)).toBeVisible();
        await projectPage.startNewDeployment();
        await configure.continueWithOwnContainer();
        await expect(configure.deployTarget()).toContainText(project);
      });

      await test.step("the deployment is created and leased", async () => {
        await configure.fillDeploymentName(deployment);
        await configure.fillImageName("nginx:latest");
        await configure.requestQuotes();
        await page.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 90_000 });
        dseq = new URL(page.url()).pathname.match(/\/new-deployment\/configure\/(\d+)/)?.[1];
        expect(dseq).toBeTruthy();

        await configure.selectFirstAvailableProvider();
        await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
        await configure.confirmAndDeploy();
        await page.waitForURL(new RegExp(`/deployments/${dseq}(?:[/?]|$)`), { timeout: 180_000 });
      });

      await test.step("the project holds the deployment", async () => {
        await projects.goto();
        await expect(projects.projectFolder(project)).toHaveAccessibleName(`Open ${project}, 1 active deployment`, { timeout: 30_000 });
        await projects.openProject(project);
        await expect(projectPage.listedDeployment(deployment)).toBeVisible({ timeout: 30_000 });
      });

      await test.step("the team's activity names the deployment and the project it went to", async () => {
        await projects.goto();
        const activity = projects.deploymentActivity(deployment);
        await expect(activity).toContainText("deployed", { timeout: 30_000 });
        await expect(activity.getByRole("link", { name: project, exact: true })).toBeVisible();
      });
    } finally {
      if (dseq) await closeDeployment(page, dseq);
    }
  });
});

/** Every name doubles as its slug, so a project is created under exactly that name and a team is linked to by it. */
function createNames() {
  const suffix = crypto.randomUUID().slice(0, 8);

  return { team: `e2e-team-${suffix}`, sharedProject: `shared-${suffix}`, hiddenProject: `hidden-${suffix}`, deployment: `e2e-deploy-${suffix}` };
}

/** A team never gets a trial, so it pays the standard minimum top-up before it can deploy. */
async function buyMinimumCredits(page: Page) {
  const billing = new BillingPage(page);
  const addCredits = new AddCreditsSheetPage(page);

  await billing.goto();
  await billing.openAddToBalance();
  await addCredits.waitForOpen();
  await addCredits.enterCustomAmount(STANDARD_TOP_UP_MIN_AMOUNT_USD);
  await addCredits.fillStripeAddress({ name: "E2E Test User", line1: "123 Test Street", city: "San Francisco", state: "CA", zip: "94105" });
  await addCredits.fillStripeCard({ number: "4242424242424242", expiry: "12/30", cvc: "123" });
  await addCredits.submit();
  await expect(billing.getPaymentSuccessMessage()).toBeVisible({ timeout: 90_000 });
}

/** Closed straight through the api, so a deployment the run created is closed even when the page is in no state to drive the UI. */
async function closeDeployment(page: Page, dseq: string) {
  await page.request.delete(`${testEnvConfig.BASE_URL}/api/proxy/v1/deployments/${dseq}`, { failOnStatusCode: false, timeout: 60_000 }).catch(() => undefined);
}

/** Billing shows the full header even while a new user's personal account is still in onboarding. */
async function createTeam(page: Page, team: string) {
  await page.goto(`${testEnvConfig.BASE_URL}/billing`);
  await new OrganizationSwitcher(page).createOrganization(team);
  await page.waitForURL(url => url.pathname === "/members");
  await expect(new MembersPage(page).heading()).toBeVisible();
  await expect(new OrganizationSwitcher(page).trigger(team)).toBeVisible();
}

async function createProjects(page: Page, names: string[]) {
  const projects = new ProjectsPage(page);
  await projects.goto();
  for (const name of names) {
    await projects.createProject(name);
    await expect(projects.projectFolder(name)).toBeVisible();
  }
}

async function listProjects(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  expect(response.status()).toBe(200);

  return (await response.json()) as ProjectList;
}
