import type { APIRequestContext, Page, PlaywrightWorkerArgs } from "@playwright/test";

import { expect, getUserAgent } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { InvitationPage } from "../pages/InvitationPage";
import { type InvitedRole, MembersPage } from "../pages/MembersPage";
import { OrganizationSettingsPage } from "../pages/OrganizationSettingsPage";
import { OrganizationSwitcher } from "../pages/OrganizationSwitcher";
import { ProjectsPage } from "../pages/ProjectsPage";
import type { Auth0ManagementService } from "../services/auth0-management.service";
import { signInPasswordless } from "./auth";
import { deleteOwnedTeams } from "./team-janitor";

export { ACTIVE_ORGANIZATION_COOKIE } from "./team-janitor";

export type ProjectList = { data: { id: string; name: string }[] };

export type OrganizationList = { data: { id: string; name: string; type: "personal" | "team"; role: string; isActive: boolean }[] };

type CreatedApiKey = { data: { id: string; apiKey: string; organizationId: string | null; projectId: string | null } };

export const PROXY_API_URL = `${testEnvConfig.BASE_URL}/api/proxy`;

/** The console api itself, which API key holders call without going through the app. */
export const DIRECT_API_URL = `${testEnvConfig.BASE_URL}/api-${testEnvConfig.NETWORK_ID}`;

/** Every name doubles as its slug, so a project is created under exactly that name and a team is linked to by it. */
export function createNames() {
  const suffix = crypto.randomUUID().slice(0, 8);

  return {
    suffix,
    team: `e2e-team-${suffix}`,
    sharedProject: `shared-${suffix}`,
    hiddenProject: `hidden-${suffix}`,
    deployment: `e2e-deploy-${suffix}`
  };
}

export async function createProjects(page: Page, names: string[]) {
  const projects = new ProjectsPage(page);
  await projects.goto();
  for (const name of names) {
    await projects.createProject(name);
    await expect(projects.projectFolder(name)).toBeVisible();
  }
}

export async function listProjects(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  expect(response.status()).toBe(200);

  return (await response.json()) as ProjectList;
}

export async function listOrganizations(request: APIRequestContext) {
  const response = await request.get(`${PROXY_API_URL}/v1/organizations`);

  return (await response.json()) as OrganizationList;
}

/** Signs the teammate up from a copied invite link, since the inbox keeps only the text of an email and drops its links. */
export async function joinTeamByInvite(input: { ownerPage: Page; teammatePage: Page; team: string; email: string; projectName?: string; role?: InvitedRole }) {
  const members = new MembersPage(input.ownerPage);
  const invitation = new InvitationPage(input.teammatePage);

  await members.goto();
  await members.inviteMember({ organizationName: input.team, email: input.email, projectName: input.projectName, role: input.role });
  await expect(input.ownerPage.getByText(`Invite sent to ${input.email}`)).toBeVisible();
  await invitation.goto(await members.copyInviteLink(input.email));
  await invitation.signUpToAccept();
  await signInPasswordless(input.teammatePage, input.email);
  await invitation.accept();
  await expect(new OrganizationSwitcher(input.teammatePage).trigger(input.team)).toBeVisible();
}

/** Created through the app's session, so the key is bound to whichever organization the session is active in. */
export async function createApiKey(request: APIRequestContext, input: { name: string; projectId?: string }) {
  const response = await request.post(`${PROXY_API_URL}/v1/api-keys`, { data: { data: input } });
  expect(response.status()).toBe(201);

  return ((await response.json()) as CreatedApiKey).data;
}

export async function openApiKeyClient(playwright: PlaywrightWorkerArgs["playwright"], apiKey: string) {
  return await playwright.request.newContext({
    baseURL: `${DIRECT_API_URL}/`,
    extraHTTPHeaders: { "x-api-key": apiKey, "user-agent": getUserAgent() }
  });
}

/** Deleting the team the owner works in moves them back to their personal account. */
export async function deleteTeam(page: Page, team: string) {
  const settings = new OrganizationSettingsPage(page);
  const switcher = new OrganizationSwitcher(page);

  await settings.goto();
  await settings.deleteOrganization(team);
  await expect(page.getByText(`Deleted ${team}`)).toBeVisible();
  await page.waitForURL(url => url.pathname !== "/organization");
  await expect(switcher.trigger(team)).toBeHidden();

  const organizations = await listOrganizations(page.request);
  expect(organizations.data.map(organization => organization.name)).not.toContain(team);
  expect(organizations.data.find(organization => organization.isActive)?.type).toBe("personal");
}

/** Deleted straight through the api, so a run that fails before deleting its team in the UI leaves no team behind on beta. */
export async function deleteTeamsLeftBehind(page: Page) {
  await deleteOwnedTeams(page, testEnvConfig.BASE_URL);
}

export async function deleteAuth0UserQuietly(auth0: Auth0ManagementService, email: string) {
  const user = await auth0.getUserByEmail(email).catch(() => undefined);
  if (user) await auth0.deleteUser(user.user_id).catch(() => undefined);
}
