import type { APIRequestContext, APIResponse, Page } from "@playwright/test";

import { signInPasswordless } from "../actions/auth";
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
  openApiKeyClient,
  type OrganizationList,
  PROXY_API_URL
} from "../actions/organization";
import { buyMinimumCredits, createTeam, TEST_CARD_LAST4 } from "../actions/team";
import { expect, openSignedOutPage, test } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { BillingPage } from "../pages/BillingPage";
import { InvitationPage } from "../pages/InvitationPage";
import { MembersPage } from "../pages/MembersPage";
import { OrganizationSettingsPage } from "../pages/OrganizationSettingsPage";
import { OrganizationSwitcher } from "../pages/OrganizationSwitcher";
import { ProjectPage } from "../pages/ProjectPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SettingsNav } from "../pages/SettingsNav";
import { createInboxClient } from "../services/email-verification";
import { waitForEmail } from "../services/inbox-email";

/** A team's first purchase reaches its wallet only after the payment confirms. */
const WALLET_FUNDING_DEADLINE_MS = 3 * 60_000;

/** The api answers 409 while a wallet is still being created and 402 until a purchase has funded it. */
const WALLET_NOT_READY_STATUSES = [409, 402];

const POLL_INTERVALS_MS = [5_000];

const SESSION_REQUIRED_ERROR_CODE = "session_required";

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

type CurrentUser = { id: string; email: string; username: string | null };

type ApiError = { code?: string };

type InvitationRequest = {
  emails: string[];
  role: "member" | "viewer" | "billing";
  projectAccess?: "all" | "selected";
  projectGrants?: { projectId: string; role: "member" | "viewer" }[];
};

type Invitation = { id: string; email: string; role: string; projectAccess: string; projectGrants: { projectId: string; role: string }[] };

type InvitationPreview = { organizationName: string; role: string; email: string; status: string };

type Member = { id: string; userId: string; email: string | null; role: string };

type Project = { id: string; name: string };

type ListedProject = Project & { deployments: { activeCount: number } | null; access: { canDeploy: boolean; canManage: boolean } };

type DeploymentPage = { deployments: { deployment: { id: { dseq: string } } }[] };

type Wallet = { address: string; isTrialing: boolean };

type TransactionPage = { transactions: { id: string }[] };

test.describe("Teams and people in the app", () => {
  test.use({ userType: "new" });
  test.setTimeout(12 * 60_000);

  test("an owner creates a team, lands in it as its owner, and is never sent to trial onboarding", async ({ page }) => {
    const { team } = createNames();
    const visitedPaths: string[] = [];
    const members = new MembersPage(page);
    const projects = new ProjectsPage(page);

    page.on("framenavigated", frame => {
      if (frame === page.mainFrame()) visitedPaths.push(new URL(frame.url()).pathname);
    });

    try {
      await test.step("the owner creates a team and lands on its members page", async () => {
        await createTeam(page, team);
      });

      await test.step("the members page lists the creator as the team's owner", async () => {
        const owner = await currentUserOf(page.request);
        await expect(members.memberRow(owner.email)).toContainText("Owner");
        await expect(members.inviteButton()).toBeVisible();
      });

      await test.step("the app's home, deployments and projects open inside the team instead of trial onboarding, also after a reload", async () => {
        const deploymentsHeading = page.getByRole("heading", { level: 1, name: "Deployments" });
        await page.goto(testEnvConfig.BASE_URL);
        await page.waitForURL(url => url.pathname === "/deployments", { timeout: 60_000 });
        await expect(deploymentsHeading).toBeVisible({ timeout: 60_000 });
        await page.reload();
        await expect(deploymentsHeading).toBeVisible({ timeout: 60_000 });

        await projects.goto();
        await expect(projects.heading()).toBeVisible({ timeout: 60_000 });
        await expect(new OrganizationSwitcher(page).trigger(team)).toBeVisible();

        expect(visitedPaths.filter(path => path.startsWith("/onboarding"))).toEqual([]);
      });
    } finally {
      await deleteTeamsLeftBehind(page);
    }
  });

  test("an owner invites a teammate to one project, the email arrives, and resending, copying and revoking the invite all work", async ({ page, browser }) => {
    const { team, sharedProject, hiddenProject } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const subject = invitationSubject(team);
    const visitorPage = await openSignedOutPage(browser);
    const members = new MembersPage(page);
    const invitation = new InvitationPage(visitorPage);

    try {
      await test.step("the owner creates a team with two projects", async () => {
        await createTeam(page, team);
        await createProjects(page, [sharedProject, hiddenProject]);
      });

      await test.step("the owner invites the teammate as a member of one project", async () => {
        await members.goto();
        await members.inviteMember({ organizationName: team, email: teammateEmail, projectName: sharedProject });
        await expect(page.getByText(`Invite sent to ${teammateEmail}`)).toBeVisible();
        await expect(members.pendingInvite(teammateEmail)).toContainText("Member");
      });

      const firstEmail = await test.step("the invitation email reaches the teammate", async () => {
        return await waitForEmail(inbox, { email: teammateEmail, subject });
      });

      await test.step("resending the invite sends a second email", async () => {
        await members.resendInvite(teammateEmail);
        await expect(page.getByText(`Invite resent to ${teammateEmail}`)).toBeVisible();
        await waitForEmail(inbox, { email: teammateEmail, subject, receivedAfterMs: firstEmail.receivedMs + 1 });
      });

      const link = await test.step("the copied link opens the invitation for a signed-out visitor", async () => {
        const copiedLink = await members.copyInviteLink(teammateEmail);
        await invitation.goto(copiedLink);
        await expect(invitation.heading(team)).toBeVisible();
        await expect(invitation.signUpLink()).toBeVisible();

        return copiedLink;
      });

      await test.step("the owner revokes the invite, whose link then lets nobody join", async () => {
        await members.revokeInvite(teammateEmail);
        await expect(page.getByText(`Invite to ${teammateEmail} revoked`)).toBeVisible();
        await expect(members.pendingInvite(teammateEmail)).toBeHidden();

        await visitorPage.goto("about:blank");
        await invitation.goto(link);
        await expect(invitation.revokedNotice()).toBeVisible();
        await expect(invitation.signUpLink()).toBeHidden();
        await expect(invitation.acceptButton()).toBeHidden();
      });
    } finally {
      await deleteTeamsLeftBehind(page);
      await visitorPage.context().close();
    }
  });

  test("an invitee signs up from the link while signed out and lands in the team, and joining under another email asks for confirmation first", async ({
    page,
    browser,
    auth0
  }) => {
    const { team, sharedProject, hiddenProject } = createNames();
    const { team: secondTeam } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const otherAddress = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const members = new MembersPage(page);
    const invitation = new InvitationPage(teammatePage);
    const teammateSwitcher = new OrganizationSwitcher(teammatePage);
    const teammateProjects = new ProjectsPage(teammatePage);

    try {
      await test.step("the owner creates a team with two projects and invites the teammate to one of them", async () => {
        await createTeam(page, team);
        await createProjects(page, [sharedProject, hiddenProject]);
        await members.goto();
        await members.inviteMember({ organizationName: team, email: teammateEmail, projectName: sharedProject });
        await expect(page.getByText(`Invite sent to ${teammateEmail}`)).toBeVisible();
      });

      await test.step("the teammate opens the link signed out, signs up, accepts and lands in the team", async () => {
        await invitation.goto(await members.copyInviteLink(teammateEmail));
        await expect(invitation.heading(team)).toBeVisible();
        await invitation.signUpToAccept();
        await signInPasswordless(teammatePage, teammateEmail);
        await invitation.accept();
        await expect(teammatePage.getByText(`You joined ${team}`)).toBeVisible();
        await teammatePage.waitForURL(url => url.pathname === "/projects", { timeout: 30_000 });
        await expect(teammateSwitcher.trigger(team)).toBeVisible();
      });

      await test.step("the teammate sees only the project they were given", async () => {
        await acceptFairUsePolicyIfPrompted(teammatePage, { settledBy: teammateProjects.heading() });
        await expect(teammateProjects.projectFolder(sharedProject)).toBeVisible();
        await expect(teammateProjects.projectFolder(hiddenProject)).toBeHidden();
      });

      const link = await test.step("the owner creates a second team and invites an address the teammate is not signed in under", async () => {
        await createTeam(page, secondTeam);
        await members.inviteMember({ organizationName: secondTeam, email: otherAddress });
        await expect(page.getByText(`Invite sent to ${otherAddress}`)).toBeVisible();

        return await members.copyInviteLink(otherAddress);
      });

      await test.step("the signed-in teammate opens that link and is asked to confirm the other email, and declining keeps them out", async () => {
        await invitation.goto(link);
        await expect(invitation.heading(secondTeam)).toBeVisible();
        await invitation.accept();
        await expect(invitation.emailMismatchDialog()).toContainText(`This invitation was sent to ${otherAddress}, but you're signed in as ${teammateEmail}.`);
        await invitation.declineEmailMismatch();
        await expect(invitation.emailMismatchDialog()).toBeHidden();
        await expect(invitation.acceptButton()).toBeVisible();

        const memberships = await listOrganizations(teammatePage.request);
        expect(memberships.data.map(organization => organization.name)).not.toContain(secondTeam);
      });

      await test.step("confirming the other email joins the teammate to the second team", async () => {
        await invitation.accept();
        await invitation.confirmEmailMismatch();
        await expect(teammatePage.getByText(`You joined ${secondTeam}`)).toBeVisible();
        await expect(teammateSwitcher.trigger(secondTeam)).toBeVisible();
      });
    } finally {
      await deleteTeamsLeftBehind(page);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });

  test("an owner hands the team to a teammate and gets it back, then removes and re-invites them", async ({ page, browser, auth0 }) => {
    const { team } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const members = new MembersPage(page);
    const settings = new OrganizationSettingsPage(page);
    const teammateSettings = new OrganizationSettingsPage(teammatePage);
    const invitation = new InvitationPage(teammatePage);
    const teammateSwitcher = new OrganizationSwitcher(teammatePage);

    try {
      await test.step("the owner creates a team and the teammate joins it from an invite", async () => {
        await createTeam(page, team);
        await joinTeamByInvite({ ownerPage: page, teammatePage, team, email: teammateEmail });
        await teammateSettings.goto();
        await acceptFairUsePolicyIfPrompted(teammatePage, { settledBy: teammateSettings.heading() });
      });

      const ownerName = displayNameOf(await currentUserOf(page.request));
      const teammateName = displayNameOf(await currentUserOf(teammatePage.request));

      await test.step("the owner transfers ownership to the teammate", async () => {
        await settings.goto();
        await settings.transferOwnership(teammateName);
        await expect(settings.ownerNotice({ ownerName: teammateName, organizationName: team })).toBeVisible();
        await members.goto();
        await expect(members.memberRow(teammateEmail)).toContainText("Owner");
      });

      await test.step("the teammate, now the owner, transfers it back", async () => {
        await teammateSettings.goto();
        await teammateSettings.transferOwnership(ownerName);
        await expect(teammateSettings.ownerNotice({ ownerName, organizationName: team })).toBeVisible();
      });

      await test.step("the owner removes the teammate, who loses access to the team", async () => {
        await members.goto();
        await members.removeMember(teammateEmail);
        await expect(members.memberRow(teammateEmail)).toBeHidden();

        const teamRequest = await teammatePage.request.get(`${PROXY_API_URL}/v1/projects`);
        expect(teamRequest.status()).toBe(403);
      });

      await test.step("the owner invites the teammate again, who accepts while signed in and is back in the team", async () => {
        await members.inviteMember({ organizationName: team, email: teammateEmail });
        await expect(page.getByText(`Invite sent to ${teammateEmail}`)).toBeVisible();
        await invitation.goto(await members.copyInviteLink(teammateEmail));
        await expect(invitation.heading(team)).toBeVisible();
        await invitation.accept();
        await expect(teammatePage.getByText(`You joined ${team}`)).toBeVisible();
        await expect(teammateSwitcher.trigger(team)).toBeVisible();

        await members.goto();
        await expect(members.memberRow(teammateEmail)).toContainText("Member");
      });
    } finally {
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(teammatePage);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });

  test("a viewer only reads their project's deployments and a billing member sees only billing", async ({ page, browser, auth0 }) => {
    const { team, sharedProject, hiddenProject, deployment } = createNames();
    const inbox = createInboxClient();
    const viewerEmail = inbox.generateEmail();
    const billingEmail = inbox.generateEmail();
    const viewerPage = await openSignedOutPage(browser);
    const billingPage = await openSignedOutPage(browser);
    const members = new MembersPage(page);

    try {
      await test.step("the owner creates a funded team with two projects and a deployment in one of them", async () => {
        await createTeam(page, team);
        await createProjects(page, [sharedProject, hiddenProject]);
        await buyMinimumCredits(page);
        const shared = await findProject(page.request, `${PROXY_API_URL}/v1/projects`, sharedProject);
        await createDeployment(page.request, `${PROXY_API_URL}/v1/deployments`, { name: deployment, projectId: shared.id });
      });

      await test.step("the owner invites a viewer to that project and a billing member, who both join", async () => {
        await joinTeamByInvite({ ownerPage: page, teammatePage: viewerPage, team, email: viewerEmail, projectName: sharedProject, role: "Viewer" });
        await joinTeamByInvite({ ownerPage: page, teammatePage: billingPage, team, email: billingEmail, role: "Billing" });
        await members.goto();
        await expect(members.memberRow(viewerEmail)).toContainText("Viewer");
        await expect(members.memberRow(billingEmail)).toContainText("Billing");
      });

      await test.step("the viewer sees their project's deployment without a way to create, select or close anything", async () => {
        const projects = new ProjectsPage(viewerPage);
        const project = new ProjectPage(viewerPage);
        await projects.goto();
        await acceptFairUsePolicyIfPrompted(viewerPage, { settledBy: projects.heading() });
        await expect(projects.projectFolder(sharedProject)).toBeVisible();
        await expect(projects.projectFolder(hiddenProject)).toBeHidden();
        await expect(viewerPage.getByRole("button", { name: "New project" })).toBeHidden();

        await projects.openProject(sharedProject);
        await expect(project.deploymentLink(deployment)).toBeVisible({ timeout: 60_000 });
        await expect(project.listedDeployment(deployment)).toBeHidden();
        await expect(project.newDeploymentLink()).toBeHidden();
      });

      await test.step("the viewer cannot invite anyone and is not offered billing or usage", async () => {
        const viewerMembers = new MembersPage(viewerPage);
        const viewerSettings = new SettingsNav(viewerPage);
        await viewerMembers.goto();
        await expect(viewerPage.getByText(`You're a Viewer of ${team}.`)).toBeVisible();
        await expect(viewerMembers.inviteButton()).toBeHidden();
        await expect(viewerSettings.link("Members")).toBeVisible();
        await expect(viewerSettings.link("Billing")).toBeHidden();
        await expect(viewerSettings.link("Usage")).toBeHidden();
      });

      await test.step("the billing member gets billing and usage, and sees the owner's card payment", async () => {
        const billingMembers = new MembersPage(billingPage);
        const billingSettings = new SettingsNav(billingPage);
        const billing = new BillingPage(billingPage);
        await billingMembers.goto();
        await acceptFairUsePolicyIfPrompted(billingPage, { settledBy: billingMembers.heading() });
        await expect(billingPage.getByText(`You're a Billing of ${team}.`)).toBeVisible();
        await expect(billingMembers.inviteButton()).toBeHidden();
        await expect(billingSettings.link("Billing")).toBeVisible();
        await expect(billingSettings.link("Usage")).toBeVisible();

        await billing.goto();
        await expect(billing.cardPayment(TEST_CARD_LAST4)).toBeVisible({ timeout: 30_000 });
        await expect(billingPage.getByRole("button", { name: /add to balance/i })).toBeVisible();
      });

      await test.step("the billing member sees no deployment and cannot create projects or deployments", async () => {
        const projects = new ProjectsPage(billingPage);
        const project = new ProjectPage(billingPage);
        await projects.goto();
        await expect(projects.heading()).toBeVisible();
        await expect(billingPage.getByRole("button", { name: "New project" })).toBeHidden();

        await projects.openProject(sharedProject);
        await expect(project.restrictedAccessNotice()).toBeVisible({ timeout: 60_000 });
        await expect(project.deploymentLink(deployment)).toBeHidden();
        await expect(project.newDeploymentLink()).toBeHidden();
      });
    } finally {
      await deleteTeamsLeftBehind(page);
      await viewerPage.context().close();
      await billingPage.context().close();
      await deleteAuth0UserQuietly(auth0, viewerEmail);
      await deleteAuth0UserQuietly(auth0, billingEmail);
    }
  });
});

test.describe("Teams and people through the API", () => {
  test.use({ userType: "new" });
  test.setTimeout(12 * 60_000);

  test("creating a team takes a session, and the owner's team key sees the team as its owner, without a trial", async ({ page, playwright }) => {
    const { team, suffix } = createNames();
    const clients: APIRequestContext[] = [];

    try {
      const personalKey = await test.step("an API key from the personal account is refused when it creates a team", async () => {
        const created = await createApiKey(page.request, { name: `e2e-personal-key-${suffix}` });
        const api = await openApiKeyClient(playwright, created.apiKey);
        clients.push(api);

        const refusal = await api.post("v1/organizations", { data: { data: { name: team } } });
        await expectRefusal(refusal, { status: 403, code: SESSION_REQUIRED_ERROR_CODE });

        return api;
      });

      const createdTeam = await test.step("the session creates the team, with its creator as owner", async () => {
        return await createTeamThroughSession(page, team);
      });

      const teamKey =
        await test.step("a key created in the team acts in it as its owner, while the personal key still sees only the personal account", async () => {
          const created = await createApiKey(page.request, { name: `e2e-team-key-${suffix}` });
          expect(created.organizationId).toBe(createdTeam.id);
          const api = await openApiKeyClient(playwright, created.apiKey);
          clients.push(api);

          const organizations = await readData<Organization[]>(await api.get("v1/organizations"));
          expect(organizations).toEqual([expect.objectContaining({ id: createdTeam.id, name: team, type: "team", role: "owner", isActive: true })]);

          const personalOrganizations = await readData<Organization[]>(await personalKey.get("v1/organizations"));
          expect(personalOrganizations.map(organization => organization.type)).toEqual(["personal"]);

          return api;
        });

      await test.step("the team's wallet is not on a trial", async () => {
        const owner = await currentUserOf(page.request);
        const wallets = await readData<Wallet[]>(await teamKey.get("v1/wallets", { params: { userId: owner.id } }));
        expect(wallets).toEqual([expect.objectContaining({ isTrialing: false })]);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });

  test("with the owner's key, an owner invites, resends, relinks and revokes; accepting takes a session; ownership moves and returns; the teammate is removed and re-invited", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { team, sharedProject, suffix } = createNames();
    const { team: secondTeam } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const revokedAddress = inbox.generateEmail();
    const otherAddress = inbox.generateEmail();
    const subject = invitationSubject(team);
    const teammatePage = await openSignedOutPage(browser);
    const clients: APIRequestContext[] = [];
    const openKey = async (request: APIRequestContext, name: string) => {
      const created = await createApiKey(request, { name: `${name}-${suffix}` });
      const client = await openApiKeyClient(playwright, created.apiKey);
      clients.push(client);

      return { client, organizationId: created.organizationId };
    };

    try {
      const { ownerKey, createdTeam, project } = await test.step("the owner creates a team through the session, then a project with a team key", async () => {
        const created = await createTeamThroughSession(page, team);
        const key = await openKey(page.request, "e2e-owner-key");
        expect(key.organizationId).toBe(created.id);
        const sharedProjectCreated = await readData<Project>(await key.client.post("v1/projects", { data: { data: { name: sharedProject } } }), 201);

        return { ownerKey: key.client, createdTeam: created, project: sharedProjectCreated };
      });

      const teammate = await test.step("the teammate signs up for an account of their own", async () => {
        return await signUp(teammatePage, teammateEmail);
      });

      const invitation = await test.step("the owner's key invites the teammate as a member of one project, and the email arrives", async () => {
        const invited = await inviteThroughKey(ownerKey, {
          emails: [teammateEmail],
          role: "member",
          projectAccess: "selected",
          projectGrants: [{ projectId: project.id, role: "member" }]
        });
        expect(invited).toMatchObject({
          email: teammateEmail,
          role: "member",
          projectAccess: "selected",
          projectGrants: [{ projectId: project.id, role: "member" }]
        });

        return { ...invited, firstEmail: await waitForEmail(inbox, { email: teammateEmail, subject }) };
      });

      const secondEmail = await test.step("the owner's key resends the invite, which sends a second email", async () => {
        const resend = await ownerKey.post(`v1/organization-invitations/${invitation.id}/resend`);
        expect(resend.status(), await resend.text()).toBe(200);

        return await waitForEmail(inbox, { email: teammateEmail, subject, receivedAfterMs: invitation.firstEmail.receivedMs + 1 });
      });

      const token = await test.step("the owner's key mints a link whose token previews the pending invitation", async () => {
        const linkToken = await mintInvitationToken(ownerKey, invitation.id);
        expect(await previewInvitation(ownerKey, linkToken)).toMatchObject({ organizationName: team, role: "member", email: teammateEmail, status: "pending" });

        return linkToken;
      });

      await test.step("the owner's key revokes another invite, whose link then lets nobody join", async () => {
        const revoked = await inviteThroughKey(ownerKey, { emails: [revokedAddress], role: "member", projectAccess: "all" });
        const revokedToken = await mintInvitationToken(ownerKey, revoked.id);
        const revoke = await ownerKey.delete(`v1/organization-invitations/${revoked.id}`);
        expect(revoke.status(), await revoke.text()).toBe(204);

        expect(await previewInvitation(ownerKey, revokedToken)).toMatchObject({ status: "revoked" });
        const pending = await readData<Invitation[]>(await ownerKey.get("v1/organization-invitations"));
        expect(pending.map(pendingInvitation => pendingInvitation.email)).toEqual([teammateEmail]);
        await expectRefusal(await acceptThroughSession(teammatePage.request, { token: revokedToken }), { status: 410, code: "invitation_revoked" });
      });

      await test.step("an API key cannot accept the invitation, and the teammate's session can", async () => {
        const { client: personalKey } = await openKey(teammatePage.request, "e2e-teammate-personal-key");
        await expectRefusal(await personalKey.post("v1/invitations/accept", { data: { data: { token } } }), { status: 403, code: SESSION_REQUIRED_ERROR_CODE });
        expect(await findMember(ownerKey, teammateEmail)).toBeUndefined();

        const joined = await readData<Organization>(await acceptThroughSession(teammatePage.request, { token }));
        expect(joined).toMatchObject({ id: createdTeam.id, name: team, role: "member" });

        await workIn(teammatePage, createdTeam.id);
        const teammateProjects = await readData<Project[]>(await teammatePage.request.get(`${PROXY_API_URL}/v1/projects`));
        expect(teammateProjects.map(teammateProject => teammateProject.name)).toEqual([sharedProject]);
      });

      await test.step("an invitation sent to another address is refused until the teammate confirms the mismatch", async () => {
        await createTeamThroughSession(page, secondTeam);
        const { client: secondTeamKey } = await openKey(page.request, "e2e-second-team-key");
        await workIn(page, createdTeam.id);
        const mismatched = await inviteThroughKey(secondTeamKey, { emails: [otherAddress], role: "member", projectAccess: "all" });
        const mismatchedToken = await mintInvitationToken(secondTeamKey, mismatched.id);

        await expectRefusal(await acceptThroughSession(teammatePage.request, { token: mismatchedToken }), {
          status: 409,
          code: "invitation_email_mismatch"
        });
        expect((await listOrganizations(teammatePage.request)).data.map(organization => organization.name)).not.toContain(secondTeam);

        const joined = await readData<Organization>(await acceptThroughSession(teammatePage.request, { token: mismatchedToken, confirmEmailMismatch: true }));
        expect(joined).toMatchObject({ name: secondTeam, role: "member" });
      });

      const teammateKey = await test.step("the owner's key hands ownership to the teammate", async () => {
        const teammateMember = await findMember(ownerKey, teammateEmail);
        const transfer = await readData<Member>(await ownerKey.post(`v1/organization-members/${teammateMember?.id}/ownership-transfer`));
        expect(transfer).toMatchObject({ userId: teammate.id, role: "owner" });
        expect((await readData<Organization[]>(await ownerKey.get("v1/organizations")))[0].role).toBe("admin");

        await workIn(teammatePage, createdTeam.id);
        const key = await openKey(teammatePage.request, "e2e-teammate-team-key");
        expect(key.organizationId).toBe(createdTeam.id);

        return key.client;
      });

      await test.step("the teammate's key, now the owner's, hands ownership back", async () => {
        const owner = await currentUserOf(page.request);
        const ownerMember = await findMember(teammateKey, owner.email);
        const transfer = await readData<Member>(await teammateKey.post(`v1/organization-members/${ownerMember?.id}/ownership-transfer`));
        expect(transfer).toMatchObject({ userId: owner.id, role: "owner" });
        expect((await readData<Organization[]>(await ownerKey.get("v1/organizations")))[0].role).toBe("owner");
        expect((await readData<Organization[]>(await teammateKey.get("v1/organizations")))[0].role).toBe("admin");
      });

      await test.step("the owner's key removes the teammate, whose key then loses the team", async () => {
        const teammateMember = await findMember(ownerKey, teammateEmail);
        const removal = await ownerKey.delete(`v1/organization-members/${teammateMember?.id}`);
        expect(removal.status(), await removal.text()).toBe(204);
        expect(await findMember(ownerKey, teammateEmail)).toBeUndefined();

        expect((await teammateKey.get("v1/projects")).status()).toBe(403);
        expect((await teammatePage.request.get(`${PROXY_API_URL}/v1/projects`)).status()).toBe(403);
        await workInPersonalAccount(teammatePage);
      });

      await test.step("the owner's key invites the teammate again, the email arrives, and their session accepts it", async () => {
        const reinvited = await inviteThroughKey(ownerKey, {
          emails: [teammateEmail],
          role: "member",
          projectAccess: "selected",
          projectGrants: [{ projectId: project.id, role: "member" }]
        });
        await waitForEmail(inbox, { email: teammateEmail, subject, receivedAfterMs: secondEmail.receivedMs + 1 });

        const joined = await readData<Organization>(
          await acceptThroughSession(teammatePage.request, { token: await mintInvitationToken(ownerKey, reinvited.id) })
        );
        expect(joined).toMatchObject({ id: createdTeam.id, role: "member" });
        expect(await findMember(ownerKey, teammateEmail)).toMatchObject({ userId: teammate.id, role: "member" });
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(teammatePage);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });

  test("with their own keys, a viewer reads without writing and a billing member reaches billing but no project's deployments", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { team, sharedProject, hiddenProject, deployment, suffix } = createNames();
    const inbox = createInboxClient();
    const viewerEmail = inbox.generateEmail();
    const billingEmail = inbox.generateEmail();
    const viewerPage = await openSignedOutPage(browser);
    const billingPage = await openSignedOutPage(browser);
    const clients: APIRequestContext[] = [];
    const openKey = async (request: APIRequestContext, name: string) => {
      const created = await createApiKey(request, { name: `${name}-${suffix}` });
      const client = await openApiKeyClient(playwright, created.apiKey);
      clients.push(client);

      return { client, organizationId: created.organizationId };
    };

    try {
      const { ownerKey, createdTeam, shared, dseq } =
        await test.step("the owner funds a new team and deploys into one of its two projects with a team key", async () => {
          const created = await createTeamThroughSession(page, team);
          const key = await openKey(page.request, "e2e-owner-key");
          const sharedProjectCreated = await readData<Project>(await key.client.post("v1/projects", { data: { data: { name: sharedProject } } }), 201);
          await readData<Project>(await key.client.post("v1/projects", { data: { data: { name: hiddenProject } } }), 201);
          await page.goto(`${testEnvConfig.BASE_URL}/billing`);
          await expect(new OrganizationSwitcher(page).trigger(team)).toBeVisible({ timeout: 30_000 });
          await buyMinimumCredits(page);

          const createdDseq = await createDeployment(key.client, "v1/deployments", { name: deployment, projectId: sharedProjectCreated.id });

          return { ownerKey: key.client, createdTeam: created, shared: sharedProjectCreated, dseq: createdDseq };
        });

      const { viewerKey, billingKey, billingUser } =
        await test.step("a viewer of that project and a billing member join from links, each creating a key in the team", async () => {
          await signUp(viewerPage, viewerEmail);
          const billingAccount = await signUp(billingPage, billingEmail);
          const viewerInvitation = await inviteThroughKey(ownerKey, {
            emails: [viewerEmail],
            role: "viewer",
            projectAccess: "selected",
            projectGrants: [{ projectId: shared.id, role: "viewer" }]
          });
          const billingInvitation = await inviteThroughKey(ownerKey, { emails: [billingEmail], role: "billing" });

          await readData<Organization>(await acceptThroughSession(viewerPage.request, { token: await mintInvitationToken(ownerKey, viewerInvitation.id) }));
          await readData<Organization>(await acceptThroughSession(billingPage.request, { token: await mintInvitationToken(ownerKey, billingInvitation.id) }));
          await workIn(viewerPage, createdTeam.id);
          await workIn(billingPage, createdTeam.id);
          const viewer = await openKey(viewerPage.request, "e2e-viewer-key");
          const billing = await openKey(billingPage.request, "e2e-billing-key");
          expect([viewer.organizationId, billing.organizationId]).toEqual([createdTeam.id, createdTeam.id]);

          return { viewerKey: viewer.client, billingKey: billing.client, billingUser: billingAccount };
        });

      await test.step("the viewer's key reads the team, its members, its one project and that project's deployment", async () => {
        expect((await readData<Organization[]>(await viewerKey.get("v1/organizations")))[0]).toMatchObject({ id: createdTeam.id, role: "viewer" });
        const members = await readData<Member[]>(await viewerKey.get("v1/organization-members"));
        expect(members.map(member => member.role).sort()).toEqual(["billing", "owner", "viewer"]);

        const projects = await readData<ListedProject[]>(await viewerKey.get("v1/projects"));
        expect(projects).toEqual([expect.objectContaining({ id: shared.id, access: { canDeploy: false, canManage: false } })]);
        expect(projects[0].deployments?.activeCount).toBe(1);
        expect(await listDeploymentDseqs(viewerKey)).toEqual([dseq]);
        expect((await viewerKey.get(`v1/deployments/${dseq}`)).status()).toBe(200);
      });

      await test.step("the viewer's key is refused every write and the team's payments", async () => {
        expect((await viewerKey.post("v1/projects", { data: { data: { name: `viewer-${suffix}` } } })).status()).toBe(403);
        expect((await viewerKey.patch(`v1/projects/${shared.id}`, { data: { data: { description: "renamed by a viewer" } } })).status()).toBe(403);
        expect((await viewerKey.post("v1/organization-invitations", { data: { data: { emails: [inbox.generateEmail()], role: "billing" } } })).status()).toBe(
          403
        );
        expect((await viewerKey.post("v1/deployments", { data: { data: { sdl: SDL, projectId: shared.id } } })).status()).toBe(403);
        expect((await viewerKey.delete(`v1/deployments/${dseq}`)).status()).toBe(403);
        expect((await viewerKey.get("v1/stripe/transactions")).status()).toBe(403);
        expect(await listDeploymentDseqs(ownerKey)).toEqual([dseq]);
      });

      await test.step("the billing member's key reads the team's payments, cards and wallet", async () => {
        const transactions = await readData<TransactionPage>(await billingKey.get("v1/stripe/transactions"));
        expect(transactions.transactions.length).toBeGreaterThan(0);
        expect((await billingKey.get("v1/stripe/payment-methods")).status()).toBe(200);

        const owner = await currentUserOf(page.request);
        const [teamWallet] = await readData<Wallet[]>(await ownerKey.get("v1/wallets", { params: { userId: owner.id } }));
        const billingWallets = await readData<Wallet[]>(await billingKey.get("v1/wallets", { params: { userId: billingUser.id } }));
        expect(billingWallets.map(wallet => wallet.address)).toEqual([teamWallet.address]);
      });

      await test.step("the billing member's key reaches no deployment and cannot create projects or deployments", async () => {
        expect(await listDeploymentDseqs(billingKey)).toEqual([]);
        expect((await billingKey.get(`v1/deployments/${dseq}`)).status()).toBe(403);
        const projects = await readData<ListedProject[]>(await billingKey.get("v1/projects"));
        expect(projects.map(project => project.deployments)).toEqual(projects.map(() => null));
        expect((await billingKey.post("v1/projects", { data: { data: { name: `billing-${suffix}` } } })).status()).toBe(403);
        expect((await billingKey.post("v1/deployments", { data: { data: { sdl: SDL, projectId: shared.id } } })).status()).toBe(403);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      await viewerPage.context().close();
      await billingPage.context().close();
      await deleteAuth0UserQuietly(auth0, viewerEmail);
      await deleteAuth0UserQuietly(auth0, billingEmail);
    }
  });
});

function invitationSubject(organizationName: string) {
  return `Join ${organizationName} on Akash Console`;
}

async function readData<T>(response: APIResponse, status = 200): Promise<T> {
  expect(response.status(), await response.text()).toBe(status);

  return ((await response.json()) as { data: T }).data;
}

async function expectRefusal(response: APIResponse, expected: { status: number; code: string }) {
  expect(response.status(), await response.text()).toBe(expected.status);
  expect(((await response.json()) as ApiError).code).toBe(expected.code);
}

async function currentUserOf(request: APIRequestContext): Promise<CurrentUser> {
  return await readData<CurrentUser>(await request.get(`${PROXY_API_URL}/v1/user/me`));
}

/** The name a team offers a member under, as when handing it over: their username, or their email when they have none. */
function displayNameOf(user: CurrentUser): string {
  return user.username || user.email;
}

/** Signs the person up by email code, as the API path has no other way to give them an account. */
async function signUp(page: Page, email: string): Promise<CurrentUser> {
  await page.goto(`${testEnvConfig.BASE_URL}/login`);
  await signInPasswordless(page, email);
  await acceptFairUsePolicyIfPrompted(page);

  return await currentUserOf(page.request);
}

/** Creating a team answers to a signed-in session only, which then works in it through the app's proxy. */
async function createTeamThroughSession(page: Page, name: string): Promise<Organization> {
  const created = await readData<Organization>(await page.request.post(`${PROXY_API_URL}/v1/organizations`, { data: { data: { name } } }), 201);
  expect(created).toMatchObject({ name, type: "team", role: "owner" });
  await workIn(page, created.id);

  return created;
}

async function workIn(page: Page, organizationId: string) {
  await page.context().addCookies([{ name: ACTIVE_ORGANIZATION_COOKIE, value: organizationId, url: testEnvConfig.BASE_URL }]);
}

/** What the app falls back to once the team its cookie names no longer has the person, whose every proxied request it would otherwise refuse. */
async function workInPersonalAccount(page: Page) {
  await page.context().clearCookies({ name: ACTIVE_ORGANIZATION_COOKIE });
}

async function inviteThroughKey(api: APIRequestContext, invitation: InvitationRequest): Promise<Invitation> {
  const [created] = await readData<Invitation[]>(await api.post("v1/organization-invitations", { data: { data: invitation } }), 201);

  return created;
}

/** A new link retires every earlier one, the emailed link included, so the token is read from the link the api returns. */
async function mintInvitationToken(api: APIRequestContext, invitationId: string): Promise<string> {
  const { url } = await readData<{ url: string }>(await api.post(`v1/organization-invitations/${invitationId}/link`));
  const token = new URLSearchParams(new URL(url).hash.slice(1)).get("token");
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

  return token as string;
}

async function previewInvitation(api: APIRequestContext, token: string): Promise<InvitationPreview> {
  return await readData<InvitationPreview>(await api.post("v1/invitations/preview", { data: { data: { token } } }));
}

async function acceptThroughSession(request: APIRequestContext, input: { token: string; confirmEmailMismatch?: boolean }): Promise<APIResponse> {
  return await request.post(`${PROXY_API_URL}/v1/invitations/accept`, { data: { data: input } });
}

async function findMember(api: APIRequestContext, email: string): Promise<Member | undefined> {
  const members = await readData<Member[]>(await api.get("v1/organization-members"));

  return members.find(member => member.email === email);
}

async function findProject(request: APIRequestContext, url: string, name: string): Promise<Project> {
  const projects = await readData<Project[]>(await request.get(url));
  const project = projects.find(candidate => candidate.name === name);
  expect(project, `no project named ${name}`).toBeDefined();

  return project as Project;
}

async function createDeployment(request: APIRequestContext, url: string, input: { name: string; projectId: string }): Promise<string> {
  let response: APIResponse | undefined;
  await expect
    .poll(
      async () => {
        response = await request.post(url, { data: { data: { sdl: SDL, ...input } } });
        return WALLET_NOT_READY_STATUSES.includes(response.status());
      },
      { timeout: WALLET_FUNDING_DEADLINE_MS, intervals: POLL_INTERVALS_MS }
    )
    .toBe(false);

  return (await readData<{ dseq: string }>(response as APIResponse, 201)).dseq;
}

async function listDeploymentDseqs(api: APIRequestContext): Promise<string[]> {
  const page = await readData<DeploymentPage>(await api.get("v1/deployments", { params: { state: "active" } }));

  return page.deployments.map(({ deployment }) => deployment.id.dseq);
}
