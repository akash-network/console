import type { APIRequestContext, Page } from "@playwright/test";

import { signInPasswordless } from "./actions/auth";
import { acceptFairUsePolicyIfPrompted } from "./actions/fair-use-policy";
import { expect, getUserAgent, openSignedOutPage, test } from "./fixture/base-test";
import { testEnvConfig } from "./fixture/test-env.config";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { AppNav } from "./pages/AppNav";
import { InvitationPage } from "./pages/InvitationPage";
import { MembersPage } from "./pages/MembersPage";
import { OrganizationSwitcher } from "./pages/OrganizationSwitcher";
import { ProjectsPage } from "./pages/ProjectsPage";
import { createInboxClient } from "./services/email-verification";
import { waitForInvitationToken } from "./services/invitation-inbox";

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

      await test.step("the teammate signs up from the emailed invitation and joins the team", async () => {
        await invitation.goto(await waitForInvitationToken(inbox, teammateEmail));
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
});

/** Every name doubles as its slug, so a project is created under exactly that name and a team is linked to by it. */
function createNames() {
  const suffix = crypto.randomUUID().slice(0, 8);

  return { team: `e2e-team-${suffix}`, sharedProject: `shared-${suffix}`, hiddenProject: `hidden-${suffix}` };
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
