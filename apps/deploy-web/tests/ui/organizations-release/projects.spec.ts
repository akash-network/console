import type { APIRequestContext, APIResponse, Page } from "@playwright/test";

import { acceptFairUsePolicyIfPrompted } from "../actions/fair-use-policy";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  createApiKey,
  createNames,
  createProjects,
  deleteAuth0UserQuietly,
  deleteTeamsLeftBehind,
  joinTeamByInvite,
  listOrganizations,
  listProjects,
  openApiKeyClient,
  type OrganizationList,
  PROXY_API_URL
} from "../actions/organization";
import { buyMinimumCredits, createTeam } from "../actions/team";
import { expect, openSignedOutPage, test } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { ApiKeysPage } from "../pages/ApiKeysPage";
import { ConfigureDeploymentPage } from "../pages/ConfigureDeploymentPage";
import { DeploymentDetailPage } from "../pages/DeploymentDetailPage";
import { DeploymentListPage } from "../pages/DeploymentListPage";
import { OnboardingPickerPage } from "../pages/OnboardingPickerPage";
import { OrganizationSwitcher } from "../pages/OrganizationSwitcher";
import { ProjectPage } from "../pages/ProjectPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { createInboxClient } from "../services/email-verification";

/** A new account's trial wallet comes from a queued job, and a team's first purchase reaches its wallet only after the payment confirms. */
const WALLET_PROVISIONING_DEADLINE_MS = 3 * 60_000;

/** The api answers 409 while a trial wallet is still being created and 402 until a purchase has funded the wallet. */
const WALLET_NOT_READY_STATUSES = [409, 402];

/** Sandbox has a single audited provider, which bids within a minute when it is up. */
const BID_DEADLINE_MS = 2 * 60_000;

const POLL_INTERVALS_MS = [5_000];

const ORGANIZATION_MISMATCH_ERROR_CODE = "organization_mismatch";

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

type Organization = OrganizationList["data"][number];

type CurrentUser = { data: { id: string; username: string | null } };

type CreatedDeployment = { data: { dseq: string; manifest: string } };

type DeploymentDetail = { data: { deployment: { id: { owner: string; dseq: string } } } };

type LeasedDeployment = { data: { deployment: { id: { dseq: string } }; leases: { id: { dseq: string; provider: string }; state: string }[] } };

type DeploymentList = { data: { deployments: { deployment: { id: { dseq: string } }; projectId?: string | null }[] } };

type DeploymentLocation = { data: { organizationId: string; projectId: string | null } };

type BidList = { data: { bid: { id: { dseq: string; gseq: number; oseq: number; provider: string } } }[] };

type ActivityList = { data: { projectId: string | null; type: string; actor: { id: string } | null; payload: { dseq?: string } }[] };

type WalletList = { data: { address: string }[] };

type Balances = { data: { deployments: number } };

type ApiKeyList = { data: { name: string }[] };

type MemberList = { data: { id: string; userId: string; role: string }[] };

type InvitationList = { data: { id: string; email: string }[] };

type ErrorBody = { code?: string };

test.describe("Projects and organization boundaries", () => {
  test.use({ userType: "new" });
  test.setTimeout(15 * 60_000);

  test("a member granted one project sees only it, deploys into it on the team's credits, and the owner finds the deployment in the project and the activity", async ({
    page,
    browser,
    auth0
  }) => {
    const { team, sharedProject: grantedProject, hiddenProject, deployment } = createNames();
    const memberEmail = createInboxClient().generateEmail();
    const memberPage = await openSignedOutPage(browser);
    const memberProjects = new ProjectsPage(memberPage);
    const memberProject = new ProjectPage(memberPage);
    const configure = new ConfigureDeploymentPage(memberPage);
    const ownerProjects = new ProjectsPage(page);
    const ownerProject = new ProjectPage(page);
    const deploymentDetail = new DeploymentDetailPage(page);

    try {
      await test.step("the owner creates a team with two projects and buys it credits", async () => {
        await createTeam(page, team);
        await createProjects(page, [grantedProject, hiddenProject]);
        await buyMinimumCredits(page);
      });

      await test.step("the owner invites a member to one of the projects, and they join as a plain member", async () => {
        await joinTeamByInvite({ ownerPage: page, teammatePage: memberPage, team, email: memberEmail, projectName: grantedProject });
        expect(findOrganizationNamed(await listOrganizations(memberPage.request), team).role).toBe("member");
      });

      await test.step("the member sees only the project they were granted", async () => {
        await memberProjects.goto();
        await acceptFairUsePolicyIfPrompted(memberPage, { settledBy: memberProjects.heading() });
        await expect(memberProjects.projectFolder(grantedProject)).toBeVisible();
        await expect(memberProjects.projectFolder(hiddenProject)).toBeHidden();
      });

      const dseq = await test.step("the member deploys into the project from its page and leases a provider", async () => {
        await memberProjects.openProject(grantedProject);
        await memberProject.startNewDeployment();
        await configure.continueWithOwnContainer();
        await expect(configure.deployTarget()).toContainText(team);
        await expect(configure.deployTarget()).toContainText(grantedProject);
        await configure.fillDeploymentName(deployment);
        await configure.fillImageName("nginx:latest");
        await configure.requestQuotes();
        await memberPage.waitForURL(/\/new-deployment\/configure\/\d+/, { timeout: 90_000 });
        const createdDseq = new URL(memberPage.url()).pathname.match(/\/new-deployment\/configure\/(\d+)/)?.[1] ?? "";
        expect(createdDseq).toBeTruthy();

        await configure.selectFirstAvailableProvider();
        await expect(configure.reviewDialog()).toBeVisible({ timeout: 30_000 });
        await configure.confirmAndOpenDeployment(createdDseq);
        await memberPage.waitForURL(new RegExp(`/deployments/${createdDseq}(?:[/?]|$)`), { timeout: 30_000 });

        return createdDseq;
      });

      await test.step("the team's wallet, which the owner shares, pays for the deployment rather than the member's own", async () => {
        const teamId = findOrganizationNamed(await listOrganizations(page.request), team).id;
        const member = await currentUserOf(memberPage.request);
        const owner = await currentUserOf(page.request);
        await enterOrganization(memberPage, teamId);
        await enterOrganization(page, teamId);

        const payer = await deploymentOwnerOf(memberPage.request, `${PROXY_API_URL}/v1/deployments/${dseq}`);
        expect(await walletAddressesOf(memberPage.request, `${PROXY_API_URL}/v1/wallets`, member.id)).toEqual([payer]);
        expect(await walletAddressesOf(page.request, `${PROXY_API_URL}/v1/wallets`, owner.id)).toEqual([payer]);
        await expect
          .poll(() => escrowedBy(page.request, `${PROXY_API_URL}/v1/balances`, payer), { timeout: 60_000, intervals: POLL_INTERVALS_MS })
          .toBeGreaterThan(0);

        await enterOrganization(memberPage, (await personalOrganizationOf(memberPage.request)).id);
        expect(await walletAddressesOf(memberPage.request, `${PROXY_API_URL}/v1/wallets`, member.id)).not.toContain(payer);
        await enterOrganization(memberPage, teamId);
      });

      await test.step("the owner finds the deployment in the project", async () => {
        await ownerProjects.goto();
        await expect(ownerProjects.projectFolder(grantedProject)).toHaveAccessibleName(`Open ${grantedProject}, 1 active deployment`, { timeout: 30_000 });
        await ownerProjects.openProject(grantedProject);
        await expect(ownerProject.listedDeployment(deployment)).toBeVisible({ timeout: 30_000 });
      });

      await test.step("the owner finds the member's deploy, and the project it went to, in the team's activity", async () => {
        const member = await currentUserOf(memberPage.request);
        await ownerProjects.goto();
        const activity = ownerProjects.deploymentActivity(deployment);
        await expect(activity).toContainText("deployed", { timeout: 30_000 });
        await expect(activity).toContainText(member.username ?? "A member");
        await expect(activity.getByRole("link", { name: grantedProject, exact: true })).toBeVisible();
      });

      await test.step("the owner closes the member's deployment", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/deployments/${dseq}`);
        await deploymentDetail.closeDeployment();
        await deploymentDetail.expectClosed();
      });
    } finally {
      await deleteTeamsLeftBehind(page);
      await memberPage.context().close();
      await deleteAuth0UserQuietly(auth0, memberEmail);
    }
  });

  test("a member's API key reaches only the granted project, deploys and leases there on the team's credits, and the owner's key finds it under the project and in the activity", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { team, sharedProject: grantedProject, hiddenProject, deployment, suffix } = createNames();
    const memberEmail = createInboxClient().generateEmail();
    const memberPage = await openSignedOutPage(browser);
    const apiClients: APIRequestContext[] = [];

    try {
      await test.step("the owner creates a team with two projects and buys it credits", async () => {
        await createTeam(page, team);
        await createProjects(page, [grantedProject, hiddenProject]);
        await buyMinimumCredits(page);
      });

      await test.step("the owner invites a member to one of the projects, and they join as a plain member", async () => {
        await joinTeamByInvite({ ownerPage: page, teammatePage: memberPage, team, email: memberEmail, projectName: grantedProject });
        expect(findOrganizationNamed(await listOrganizations(memberPage.request), team).role).toBe("member");
      });

      const setup = await test.step("the owner and the member each create a key in the team", async () => {
        const teamId = findOrganizationNamed(await listOrganizations(page.request), team).id;
        await enterOrganization(page, teamId);
        await enterOrganization(memberPage, teamId);
        const ownerProjects = await listProjects(page.request, `${PROXY_API_URL}/v1/projects`);
        const ownerKey = await createApiKey(page.request, { name: `e2e-owner-key-${suffix}` });
        const memberKey = await createApiKey(memberPage.request, { name: `e2e-member-key-${suffix}` });
        expect([ownerKey.organizationId, memberKey.organizationId]).toEqual([teamId, teamId]);
        const ownerApi = await openApiKeyClient(playwright, ownerKey.apiKey);
        const memberApi = await openApiKeyClient(playwright, memberKey.apiKey);
        apiClients.push(ownerApi, memberApi);

        return {
          teamId,
          ownerApi,
          memberApi,
          member: await currentUserOf(memberPage.request),
          grantedProjectId: findProjectNamed(ownerProjects, grantedProject),
          hiddenProjectId: findProjectNamed(ownerProjects, hiddenProject)
        };
      });

      await test.step("the member's key lists only the granted project and finds no other", async () => {
        expect((await listProjects(setup.memberApi, "v1/projects")).data.map(project => project.name)).toEqual([grantedProject]);
        expect((await setup.memberApi.get(`v1/projects/${setup.grantedProjectId}`)).status()).toBe(200);
        expect((await setup.memberApi.get(`v1/projects/${setup.hiddenProjectId}`)).status()).toBe(404);
      });

      const dseq = await test.step("the member's key deploys into the granted project and leases the provider's bid", async () => {
        const created = await createDeployment(setup.memberApi, "v1/deployments", { name: deployment, projectId: setup.grantedProjectId });
        const leased = await leaseFirstBid(setup.memberApi, created);
        expect(leased.data.deployment.id.dseq).toBe(created.dseq);
        expect(leased.data.leases).toEqual([expect.objectContaining({ id: expect.objectContaining({ dseq: created.dseq }), state: "active" })]);

        return created.dseq;
      });

      await test.step("the team's wallet, which the owner's key shares, pays for the deployment rather than the member's own", async () => {
        const owner = await currentUserOf(page.request);
        const payer = await deploymentOwnerOf(setup.memberApi, `v1/deployments/${dseq}`);
        expect(await walletAddressesOf(setup.memberApi, "v1/wallets", setup.member.id)).toEqual([payer]);
        expect(await walletAddressesOf(setup.ownerApi, "v1/wallets", owner.id)).toEqual([payer]);
        await expect.poll(() => escrowedBy(setup.ownerApi, "v1/balances", payer), { timeout: 60_000, intervals: POLL_INTERVALS_MS }).toBeGreaterThan(0);

        await enterOrganization(memberPage, (await personalOrganizationOf(memberPage.request)).id);
        expect(await walletAddressesOf(memberPage.request, `${PROXY_API_URL}/v1/wallets`, setup.member.id)).not.toContain(payer);
        await enterOrganization(memberPage, setup.teamId);
      });

      await test.step("the owner's key lists the deployment under the granted project only", async () => {
        expect(await listDeploymentsIn(setup.ownerApi, setup.grantedProjectId)).toContainEqual({ dseq, projectId: setup.grantedProjectId });
        expect((await listDeploymentsIn(setup.ownerApi, setup.hiddenProjectId)).map(listed => listed.dseq)).not.toContain(dseq);

        const location = await setup.ownerApi.get(`v1/deployment-locations/${dseq}`);
        expect(location.status()).toBe(200);
        expect(((await location.json()) as DeploymentLocation).data).toMatchObject({ organizationId: setup.teamId, projectId: setup.grantedProjectId });
      });

      await test.step("the owner's key finds the member's deploy in the team's activity", async () => {
        await expect
          .poll(async () => (await listActivities(setup.ownerApi)).find(activity => activity.type === "deployment_created" && activity.payload.dseq === dseq), {
            timeout: 30_000,
            intervals: POLL_INTERVALS_MS
          })
          .toMatchObject({ projectId: setup.grantedProjectId, actor: { id: setup.member.id } });
      });

      await test.step("the member's key closes the deployment", async () => {
        expect((await setup.memberApi.delete(`v1/deployments/${dseq}`)).status()).toBe(200);
        expect((await listDeploymentsIn(setup.ownerApi, setup.grantedProjectId)).map(listed => listed.dseq)).not.toContain(dseq);
      });
    } finally {
      await Promise.all(apiClients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      await memberPage.context().close();
      await deleteAuth0UserQuietly(auth0, memberEmail);
    }
  });

  test("switching between the personal account and a team never mixes their deployments or keys, and an ?org= link survives a reload", async ({ page }) => {
    const { team, sharedProject: teamProject, suffix } = createNames();
    const owned = {
      team,
      teamProject,
      personalDeployment: `e2e-personal-${suffix}`,
      personalKey: `e2e-personal-key-${suffix}`,
      teamKey: `e2e-team-key-${suffix}`
    };
    const switcher = new OrganizationSwitcher(page);
    const apiKeys = new ApiKeysPage(page);
    const deployments = new DeploymentListPage(page);
    let personalDseq: string | undefined;
    let personalOrganization: Organization | undefined;

    try {
      await test.step("the owner skips onboarding, deploys in their personal account and creates a key there", async () => {
        const picker = new OnboardingPickerPage(page);
        await picker.goto();
        await expect(picker.getHeading()).toBeVisible({ timeout: 30_000 });
        await picker.skipOnboarding();
        await page.waitForURL(url => url.pathname !== "/onboarding", { timeout: 30_000 });

        personalOrganization = await personalOrganizationOf(page.request);
        await enterOrganization(page, personalOrganization.id);
        personalDseq = (await createDeployment(page.request, `${PROXY_API_URL}/v1/deployments`, { name: owned.personalDeployment })).dseq;
        await createKeyInTheUi(apiKeys, owned.personalKey);
      });

      await test.step("the owner creates a team with a project and a key of its own", async () => {
        await createTeam(page, team);
        await createProjects(page, [teamProject]);
        await createKeyInTheUi(apiKeys, owned.teamKey);
      });

      await test.step("the team shows only its own project, deployments and keys", async () => {
        await expectOnlyTeamData(page, owned);
      });

      await test.step("switching to the personal account shows only its own deployment and key", async () => {
        await switcher.switchToPersonal();
        await expect(switcher.trigger(team)).toBeHidden({ timeout: 30_000 });
        await expectOnlyPersonalData(page, owned);
      });

      await test.step("switching back to the team shows only the team's again", async () => {
        await switcher.switchTo(team);
        await expect(switcher.trigger(team)).toBeVisible({ timeout: 30_000 });
        await expectOnlyTeamData(page, owned);
      });

      await test.step("an ?org= link naming the personal account opens it from the team, and a reload keeps it", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/deployments?org=${personalOrganization?.id}`);
        await expect(deployments.listedDeployment(owned.personalDeployment)).toBeVisible({ timeout: 60_000 });
        await expect(switcher.trigger(team)).toBeHidden();
        await page.reload();
        await expect(deployments.listedDeployment(owned.personalDeployment)).toBeVisible({ timeout: 60_000 });
        await expect(switcher.trigger(team)).toBeHidden();
      });

      await test.step("an ?org= link naming the team opens it from the personal account, and a reload keeps it", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/deployments?org=${team}`);
        await expect(switcher.trigger(team)).toBeVisible({ timeout: 30_000 });
        await expect(deployments.emptyNotice()).toBeVisible({ timeout: 60_000 });
        await expect(deployments.listedDeployment(owned.personalDeployment)).toBeHidden();
        await page.reload();
        await expect(switcher.trigger(team)).toBeVisible({ timeout: 30_000 });
        await expect(deployments.emptyNotice()).toBeVisible({ timeout: 60_000 });
        await expect(deployments.listedDeployment(owned.personalDeployment)).toBeHidden();
      });
    } finally {
      await closePersonalDeployment(page, personalOrganization, personalDseq);
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a key bound to the team never returns the owner's personal deployment, keys or wallet, and a header naming another organization is refused", async ({
    page,
    playwright
  }) => {
    const { team, sharedProject: teamProject, suffix } = createNames();
    const personalDeployment = `e2e-personal-${suffix}`;
    const personalKeyName = `e2e-personal-key-${suffix}`;
    const teamKeyName = `e2e-team-key-${suffix}`;
    const apiClients: APIRequestContext[] = [];
    let personalDseq: string | undefined;
    let personalOrganization: Organization | undefined;

    try {
      const personal = await test.step("the owner deploys in their personal account and creates a key there", async () => {
        personalOrganization = await personalOrganizationOf(page.request);
        await enterOrganization(page, personalOrganization.id);
        personalDseq = (await createDeployment(page.request, `${PROXY_API_URL}/v1/deployments`, { name: personalDeployment })).dseq;
        const key = await createApiKey(page.request, { name: personalKeyName });
        expect(key.organizationId).toBe(personalOrganization.id);
        const api = await openApiKeyClient(playwright, key.apiKey);
        apiClients.push(api);

        return {
          organization: personalOrganization,
          dseq: personalDseq,
          api,
          walletAddresses: await walletAddressesOf(api, "v1/wallets", (await currentUserOf(page.request)).id)
        };
      });

      const teamSetup = await test.step("the owner creates a team with a project and a key bound to the team", async () => {
        await createTeam(page, team);
        await createProjects(page, [teamProject]);
        const teamId = findOrganizationNamed(await listOrganizations(page.request), team).id;
        await enterOrganization(page, teamId);
        const key = await createApiKey(page.request, { name: teamKeyName });
        expect(key.organizationId).toBe(teamId);
        const api = await openApiKeyClient(playwright, key.apiKey);
        apiClients.push(api);

        return { teamId, api };
      });

      await test.step("the team key sees only the team's organization, projects and keys", async () => {
        expect(await organizationNamesOf(teamSetup.api)).toEqual([team]);
        const teamProjects = (await listProjects(teamSetup.api, "v1/projects")).data;
        const personalProjectIds = (await listProjects(personal.api, "v1/projects")).data.map(project => project.id);
        expect(teamProjects.map(project => project.name)).toContain(teamProject);
        expect(teamProjects.filter(project => personalProjectIds.includes(project.id))).toEqual([]);
        const keyNames = await apiKeyNamesOf(teamSetup.api);
        expect(keyNames).toContain(teamKeyName);
        expect(keyNames).not.toContain(personalKeyName);
      });

      await test.step("the team key never returns the personal deployment, its activity or the personal wallet", async () => {
        expect(await listedDseqsOf(teamSetup.api)).not.toContain(personal.dseq);
        expect((await teamSetup.api.get(`v1/deployments/${personal.dseq}`)).status()).toBe(404);
        expect((await teamSetup.api.get(`v1/deployment-locations/${personal.dseq}`)).status()).toBe(404);
        expect((await listActivities(teamSetup.api)).map(activity => activity.payload.dseq)).not.toContain(personal.dseq);

        const teamWallets = await walletAddressesOf(teamSetup.api, "v1/wallets", (await currentUserOf(page.request)).id);
        expect(teamWallets).toHaveLength(1);
        expect(personal.walletAddresses).not.toContain(teamWallets[0]);
      });

      await test.step("the personal key still reaches the personal deployment and none of the team", async () => {
        expect(await organizationNamesOf(personal.api)).toEqual([personal.organization.name]);
        expect(await listedDseqsOf(personal.api)).toContain(personal.dseq);
        expect((await listProjects(personal.api, "v1/projects")).data.map(project => project.name)).not.toContain(teamProject);
        expect(await apiKeyNamesOf(personal.api)).not.toContain(teamKeyName);
      });

      await test.step("a key is refused when the organization header names another organization than its own", async () => {
        await expectOrganizationMismatch(await teamSetup.api.get("v1/deployments", { headers: { "x-organization-id": personal.organization.id } }));
        await expectOrganizationMismatch(await personal.api.get("v1/deployments", { headers: { "x-organization-id": teamSetup.teamId } }));
        await expectOrganizationMismatch(await personal.api.get("v1/projects", { headers: { "x-organization-id": team } }));
        expect((await teamSetup.api.get("v1/deployments", { headers: { "x-organization-id": teamSetup.teamId } })).status()).toBe(200);
      });

      await test.step("a session is refused an organization it is not a member of", async () => {
        await enterOrganization(page, crypto.randomUUID());
        expect((await page.request.get(`${PROXY_API_URL}/v1/deployments`)).status()).toBe(403);
        await enterOrganization(page, teamSetup.teamId);
      });
    } finally {
      await Promise.all(apiClients.map(client => client.dispose()));
      await closePersonalDeployment(page, personalOrganization, personalDseq);
      await deleteTeamsLeftBehind(page);
    }
  });

  test("an organization-wide key reaches and acts on every project, while a key bound to one project reaches only it and none of the organization's settings", async ({
    page,
    playwright
  }) => {
    const { team, sharedProject: boundProject, hiddenProject: otherProject, deployment, suffix } = createNames();
    const wideKeyName = `e2e-wide-key-${suffix}`;
    const boundKeyName = `e2e-bound-key-${suffix}`;
    const invitedEmail = createInboxClient().generateEmail();
    const apiKeys = new ApiKeysPage(page);
    const apiClients: APIRequestContext[] = [];

    try {
      await test.step("the owner creates a team with two projects and buys it credits", async () => {
        await createTeam(page, team);
        await createProjects(page, [boundProject, otherProject]);
        await buyMinimumCredits(page);
      });

      const setup = await test.step("the owner creates a key for the whole team and one bound to a project, which the key list tells apart", async () => {
        const wideSecret = await createKeyInTheUi(apiKeys, wideKeyName);
        const boundSecret = await createKeyInTheUi(apiKeys, boundKeyName, { projectName: boundProject });
        await expect(apiKeys.getKeyRow(wideKeyName)).toContainText("All projects");
        await expect(apiKeys.getKeyRow(boundKeyName)).toContainText(boundProject);

        const teamId = findOrganizationNamed(await listOrganizations(page.request), team).id;
        await enterOrganization(page, teamId);
        const projects = await listProjects(page.request, `${PROXY_API_URL}/v1/projects`);
        const wideApi = await openApiKeyClient(playwright, wideSecret);
        const boundApi = await openApiKeyClient(playwright, boundSecret);
        apiClients.push(wideApi, boundApi);

        return {
          teamId,
          wideApi,
          boundApi,
          sessionProjectNames: projects.data.map(project => project.name),
          ownerId: (await currentUserOf(page.request)).id,
          boundProjectId: findProjectNamed(projects, boundProject),
          otherProjectId: findProjectNamed(projects, otherProject)
        };
      });

      await test.step("the team-wide key lists every project the owner sees, both projects among them, and reads both", async () => {
        const wideProjectNames = (await listProjects(setup.wideApi, "v1/projects")).data.map(project => project.name);
        expect(wideProjectNames).toEqual(expect.arrayContaining([boundProject, otherProject]));
        expect(wideProjectNames.sort()).toEqual([...setup.sessionProjectNames].sort());
        expect((await setup.wideApi.get(`v1/projects/${setup.boundProjectId}`)).status()).toBe(200);
        expect((await setup.wideApi.get(`v1/projects/${setup.otherProjectId}`)).status()).toBe(200);
      });

      const movedDseq = await test.step("the team-wide key deploys into one project and moves the deployment to the other", async () => {
        const { dseq } = await createDeployment(setup.wideApi, "v1/deployments", { name: deployment, projectId: setup.boundProjectId });
        expect(await listDeploymentsIn(setup.wideApi, setup.boundProjectId)).toContainEqual({ dseq, projectId: setup.boundProjectId });

        const move = await setup.wideApi.patch(`v1/deployments/${dseq}/project`, { data: { data: { projectId: setup.otherProjectId } } });
        expect(move.status(), await move.text()).toBe(200);
        expect(await listDeploymentsIn(setup.wideApi, setup.otherProjectId)).toContainEqual({ dseq, projectId: setup.otherProjectId });
        expect((await listDeploymentsIn(setup.wideApi, setup.boundProjectId)).map(listed => listed.dseq)).not.toContain(dseq);

        return dseq;
      });

      await test.step("the bound key lists and reads only its project", async () => {
        expect((await listProjects(setup.boundApi, "v1/projects")).data.map(project => project.name)).toEqual([boundProject]);
        expect((await setup.boundApi.get(`v1/projects/${setup.boundProjectId}`)).status()).toBe(200);
        expect((await setup.boundApi.get(`v1/projects/${setup.otherProjectId}`)).status()).toBe(404);
      });

      await test.step("the bound key cannot see, move or create a deployment in the other project", async () => {
        expect(await listedDseqsOf(setup.boundApi)).not.toContain(movedDseq);
        expect((await setup.boundApi.get(`v1/deployment-locations/${movedDseq}`)).status()).toBe(404);
        const moveBack = await setup.boundApi.patch(`v1/deployments/${movedDseq}/project`, { data: { data: { projectId: setup.boundProjectId } } });
        expect(moveBack.status()).toBe(404);
        const intoOtherProject = await setup.boundApi.post("v1/deployments", {
          data: { data: { sdl: SDL, name: `${deployment}-refused`, projectId: setup.otherProjectId } }
        });
        expect(intoOtherProject.status(), await intoOtherProject.text()).toBe(404);
      });

      await test.step("the bound key deploys into its own project and closes the deployment", async () => {
        const { dseq } = await createDeployment(setup.boundApi, "v1/deployments", { name: `${deployment}-bound`, projectId: setup.boundProjectId });
        expect(await listDeploymentsIn(setup.boundApi, setup.boundProjectId)).toContainEqual({ dseq, projectId: setup.boundProjectId });
        expect((await setup.boundApi.delete(`v1/deployments/${dseq}`)).status()).toBe(200);
      });

      await test.step("the bound key is refused the team's settings, members and invitations, which the team-wide key manages", async () => {
        const invitation = await setup.wideApi.post("v1/organization-invitations", {
          data: { data: { emails: [invitedEmail], role: "member", projectAccess: "all" } }
        });
        expect(invitation.status(), await invitation.text()).toBe(201);
        const [{ id: invitationId }] = ((await invitation.json()) as InvitationList).data;
        const members = await setup.wideApi.get("v1/organization-members");
        expect(members.status()).toBe(200);
        const ownerMembership = ((await members.json()) as MemberList).data.find(member => member.userId === setup.ownerId);
        expect(ownerMembership?.role).toBe("owner");

        expect((await setup.boundApi.patch(`v1/organizations/${setup.teamId}`, { data: { data: { name: `${team}-renamed` } } })).status()).toBe(403);
        expect((await setup.boundApi.post("v1/projects", { data: { data: { name: `refused-${suffix}` } } })).status()).toBe(403);
        expect((await setup.boundApi.get("v1/organization-members")).status()).toBe(403);
        expect((await setup.boundApi.patch(`v1/organization-members/${ownerMembership?.id}`, { data: { data: { role: "owner" } } })).status()).toBe(403);
        expect((await setup.boundApi.delete(`v1/organization-members/${ownerMembership?.id}`)).status()).toBe(403);
        expect((await setup.boundApi.get("v1/organization-invitations")).status()).toBe(403);
        expect(
          (
            await setup.boundApi.post("v1/organization-invitations", { data: { data: { emails: [invitedEmail], role: "member", projectAccess: "all" } } })
          ).status()
        ).toBe(403);
        expect((await setup.boundApi.delete(`v1/organization-invitations/${invitationId}`)).status()).toBe(403);

        expect((await setup.wideApi.delete(`v1/organization-invitations/${invitationId}`)).status()).toBe(204);
      });

      await test.step("the team-wide key closes the moved deployment", async () => {
        expect((await setup.wideApi.delete(`v1/deployments/${movedDseq}`)).status()).toBe(200);
      });
    } finally {
      await Promise.all(apiClients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });
});

/** The app's proxy runs a request in the organization this cookie names, whatever organization the user last worked in. */
async function enterOrganization(page: Page, organizationId: string) {
  await page.context().addCookies([{ name: ACTIVE_ORGANIZATION_COOKIE, value: organizationId, url: testEnvConfig.BASE_URL }]);
}

function findOrganizationNamed(organizations: OrganizationList, name: string): Organization {
  const organization = organizations.data.find(candidate => candidate.name === name);
  expect(organization, `no organization named ${name}`).toBeDefined();

  return organization as Organization;
}

async function personalOrganizationOf(request: APIRequestContext): Promise<Organization> {
  const personal = (await listOrganizations(request)).data.find(organization => organization.type === "personal");
  expect(personal, "the user has no personal organization").toBeDefined();

  return personal as Organization;
}

function findProjectNamed(projects: { data: { id: string; name: string }[] }, name: string): string {
  const project = projects.data.find(candidate => candidate.name === name);
  expect(project, `no project named ${name}`).toBeDefined();

  return (project as { id: string }).id;
}

async function currentUserOf(request: APIRequestContext) {
  const response = await request.get(`${PROXY_API_URL}/v1/user/me`);
  expect(response.status()).toBe(200);

  return ((await response.json()) as CurrentUser).data;
}

async function createKeyInTheUi(apiKeys: ApiKeysPage, name: string, options: { projectName?: string } = {}): Promise<string> {
  await apiKeys.goto();
  await apiKeys.createKey(name, options);
  await expect(apiKeys.getCreatedKeySecret(name)).not.toBeEmpty({ timeout: 10_000 });
  const secret = (await apiKeys.getCreatedKeySecret(name).textContent()) ?? "";
  await apiKeys.closeCreatedKeyDialog(name);

  return secret;
}

async function createDeployment(request: APIRequestContext, url: string, input: { name: string; projectId?: string }) {
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

async function leaseFirstBid(api: APIRequestContext, deployment: { dseq: string; manifest: string }) {
  let bids: BidList["data"] = [];
  await expect
    .poll(
      async () => {
        const response = await api.get("v1/bids", { params: { dseq: deployment.dseq } });
        bids = response.ok() ? ((await response.json()) as BidList).data : [];
        return bids.length;
      },
      { timeout: BID_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBeGreaterThan(0);
  const { dseq, gseq, oseq, provider } = bids[0].bid.id;
  const response = await api.post("v1/leases", { data: { leases: [{ dseq, gseq, oseq, provider }], manifest: deployment.manifest } });
  expect(response.status(), await response.text()).toBe(200);

  return (await response.json()) as LeasedDeployment;
}

async function deploymentOwnerOf(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  expect(response.status()).toBe(200);

  return ((await response.json()) as DeploymentDetail).data.deployment.id.owner;
}

async function walletAddressesOf(request: APIRequestContext, url: string, userId: string) {
  const response = await request.get(url, { params: { userId } });
  expect(response.status()).toBe(200);

  return ((await response.json()) as WalletList).data.map(wallet => wallet.address);
}

async function escrowedBy(request: APIRequestContext, url: string, address: string) {
  const response = await request.get(url, { params: { address } });

  return response.ok() ? ((await response.json()) as Balances).data.deployments : 0;
}

async function listDeploymentsIn(api: APIRequestContext, projectId: string) {
  const response = await api.get("v1/deployments", { params: { projectId } });
  expect(response.status()).toBe(200);

  return ((await response.json()) as DeploymentList).data.deployments.map(listed => ({ dseq: listed.deployment.id.dseq, projectId: listed.projectId }));
}

async function listedDseqsOf(api: APIRequestContext) {
  const response = await api.get("v1/deployments");
  expect(response.status()).toBe(200);

  return ((await response.json()) as DeploymentList).data.deployments.map(listed => listed.deployment.id.dseq);
}

async function listActivities(api: APIRequestContext) {
  const response = await api.get("v1/organization-activities", { params: { limit: 100 } });
  expect(response.status()).toBe(200);

  return ((await response.json()) as ActivityList).data;
}

async function organizationNamesOf(api: APIRequestContext) {
  const response = await api.get("v1/organizations");
  expect(response.status()).toBe(200);

  return ((await response.json()) as OrganizationList).data.map(organization => organization.name);
}

async function apiKeyNamesOf(api: APIRequestContext) {
  const response = await api.get("v1/api-keys");
  expect(response.status()).toBe(200);

  return ((await response.json()) as ApiKeyList).data.map(key => key.name);
}

async function expectOrganizationMismatch(response: APIResponse) {
  expect(response.status()).toBe(400);
  expect(((await response.json()) as ErrorBody).code).toBe(ORGANIZATION_MISMATCH_ERROR_CODE);
}

type OwnedData = { team: string; teamProject: string; personalDeployment: string; personalKey: string; teamKey: string };

async function expectOnlyTeamData(page: Page, owned: OwnedData) {
  const switcher = new OrganizationSwitcher(page);
  const deployments = new DeploymentListPage(page);
  const apiKeys = new ApiKeysPage(page);
  const projects = new ProjectsPage(page);

  await deployments.goto();
  await expect(switcher.trigger(owned.team)).toBeVisible({ timeout: 30_000 });
  await expect(deployments.emptyNotice()).toBeVisible({ timeout: 60_000 });
  await expect(deployments.listedDeployment(owned.personalDeployment)).toBeHidden();

  await apiKeys.goto();
  await expect(apiKeys.getKeyRow(owned.teamKey)).toBeVisible({ timeout: 30_000 });
  await expect(apiKeys.getKeyRow(owned.personalKey)).toBeHidden();

  await projects.goto();
  await expect(projects.projectFolder(owned.teamProject)).toBeVisible({ timeout: 30_000 });
}

async function expectOnlyPersonalData(page: Page, owned: OwnedData) {
  const switcher = new OrganizationSwitcher(page);
  const deployments = new DeploymentListPage(page);
  const apiKeys = new ApiKeysPage(page);

  await deployments.goto();
  await expect(deployments.listedDeployment(owned.personalDeployment)).toBeVisible({ timeout: 60_000 });
  await expect(switcher.trigger(owned.team)).toBeHidden();

  await apiKeys.goto();
  await expect(apiKeys.getKeyRow(owned.personalKey)).toBeVisible({ timeout: 30_000 });
  await expect(apiKeys.getKeyRow(owned.teamKey)).toBeHidden();
}

/** Closed in the personal organization by name, since the team cleanup only reaches the teams' deployments. */
async function closePersonalDeployment(page: Page, personalOrganization: Organization | undefined, dseq: string | undefined) {
  if (!personalOrganization || !dseq) return;

  await enterOrganization(page, personalOrganization.id);
  await page.request.delete(`${PROXY_API_URL}/v1/deployments/${dseq}`, { failOnStatusCode: false, timeout: 60_000 }).catch(() => undefined);
}
