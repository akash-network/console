import type { APIRequestContext, APIResponse, Page, PlaywrightWorkerArgs } from "@playwright/test";

import { signInPasswordless } from "../actions/auth";
import { acceptFairUsePolicyIfPrompted } from "../actions/fair-use-policy";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  createApiKey,
  createNames,
  deleteAuth0UserQuietly,
  deleteTeamsLeftBehind,
  listOrganizations,
  openApiKeyClient,
  type OrganizationList,
  PROXY_API_URL
} from "../actions/organization";
import { createTeam } from "../actions/team";
import { expect, openSignedOutPage, test } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { MembersPage } from "../pages/MembersPage";
import { OrganizationSwitcher } from "../pages/OrganizationSwitcher";
import { ProjectsPage } from "../pages/ProjectsPage";
import { createInboxClient } from "../services/email-verification";

type Playwright = PlaywrightWorkerArgs["playwright"];

type Organization = OrganizationList["data"][number] & { slug: string };

type Project = { id: string; name: string; description: string | null };

type Member = { id: string; userId: string; email: string | null; role: string };

type Invitation = { id: string; email: string };

type InvitationPreview = { status: string };

type Budget = { id: string; monthlyAmountUsd: number };

type CurrentUser = { id: string; email: string };

type ApiError = { code?: string; data?: { limit?: number } };

const NUL = "\u0000";

/** A zero-width space, a word joiner and the blank braille pattern, which together render as nothing. */
const INVISIBLE_NAME = "​⁠⠀";

const MAX_NAME_LENGTH = 64;

const MAX_DESCRIPTION_LENGTH = 140;

const LATENCY_SAMPLES = 10;

const SWITCH_SAMPLES = 3;

const SLOW_RESPONSE_MS = 1_000;

test.describe("Organizations across the tabs of one browser", () => {
  test.use({ userType: "new" });
  test.setTimeout(6 * 60_000);

  test("a project created from a tab still showing one team is created in that team after another tab switched to a second team", async ({ page }) => {
    const { team, suffix } = createNames();
    const secondTeam = `e2e-team-b-${suffix}`;
    const projectName = `tab-${suffix}`;
    const projects = new ProjectsPage(page);
    const switcher = new OrganizationSwitcher(page);
    const otherTab = await page.context().newPage();

    try {
      const teams = await test.step("the owner creates two teams and works in the first", async () => {
        await createTeam(page, team);
        const second = await createTeamThroughSession(page, secondTeam);

        return { first: await organizationNamed(page, team), second };
      });

      await test.step("the first tab shows the first team's projects", async () => {
        await projects.goto();
        await expect(projects.heading()).toBeVisible({ timeout: 30_000 });
        await expect(switcher.trigger(team)).toBeVisible();
      });

      await test.step("a second tab of the same browser switches to the second team", async () => {
        const otherProjects = new ProjectsPage(otherTab);
        const otherSwitcher = new OrganizationSwitcher(otherTab);
        await otherProjects.goto();
        await expect(otherSwitcher.trigger(team)).toBeVisible({ timeout: 30_000 });
        await otherSwitcher.switchTo(secondTeam);
        await expect(otherSwitcher.trigger(secondTeam)).toBeVisible({ timeout: 30_000 });
      });

      await test.step("the first tab, still showing the first team, creates a project", async () => {
        await expect(switcher.trigger(team)).toBeVisible();
        await projects.createProject(projectName);
      });

      await test.step("the project belongs to the first team and not to the second", async () => {
        const inFirstTeam = await projectNamesIn(page, teams.first.id);
        const inSecondTeam = await projectNamesIn(page, teams.second.id);

        expect({ inFirstTeam: inFirstTeam.includes(projectName), inSecondTeam: inSecondTeam.includes(projectName) }).toEqual({
          inFirstTeam: true,
          inSecondTeam: false
        });
      });
    } finally {
      await otherTab.close();
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a link naming a team the person no longer belongs to says so instead of quietly opening another organization", async ({ page }) => {
    const { team, suffix } = createNames();
    const goneTeam = `e2e-gone-${suffix}`;
    const switcher = new OrganizationSwitcher(page);
    const projects = new ProjectsPage(page);

    try {
      const gone = await test.step("the owner creates a team, then a second one that they delete", async () => {
        await createTeam(page, team);
        const created = await createTeamThroughSession(page, goneTeam);
        const active = await organizationNamed(page, team);
        await workIn(page, created.id);
        const deletion = await page.request.delete(`${PROXY_API_URL}/v1/organizations/${created.id}`);
        expect(deletion.status(), await deletion.text()).toBe(204);
        await workIn(page, active.id);

        return created;
      });

      await test.step("a link to the deleted team's projects opens with a notice that the team cannot be opened", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/projects?org=${gone.slug}`);
        await expect(projects.heading()).toBeVisible({ timeout: 30_000 });
        await expect(switcher.trigger(team)).toBeVisible();
        await expect(page.getByText(/no longer|not a member|can(no|')t (be )?open|don't have access|isn't available|not available/i)).toBeVisible();
      });
    } finally {
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a double click on Create organization creates one team and reports no failure", async ({ page }) => {
    const { team } = createNames();
    const switcher = new OrganizationSwitcher(page);

    try {
      await test.step("the owner double clicks Create organization and lands in the new team", async () => {
        await page.goto(`${testEnvConfig.BASE_URL}/billing`);
        await switcher.createOrganization(team, { doubleClick: true });
        await page.waitForURL(url => url.pathname === "/members", { timeout: 30_000 });
        await expect(new MembersPage(page).heading()).toBeVisible({ timeout: 30_000 });
        await expect(switcher.trigger(team)).toBeVisible();
      });

      await test.step("exactly one team carries the name, and no failure was shown", async () => {
        const named = (await listOrganizations(page.request)).data.filter(organization => organization.name === team);
        expect(named).toHaveLength(1);
        await expect(page.getByText(/Couldn't create the organization|already belong to an organization/)).toBeHidden();
      });
    } finally {
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a team tab left open by an admin who was removed creates nothing anywhere and tells them they left the team", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { team, suffix } = createNames();
    const projectName = `stale-${suffix}`;
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const teammateProjects = new ProjectsPage(teammatePage);
    const teammateSwitcher = new OrganizationSwitcher(teammatePage);
    const clients: APIRequestContext[] = [];

    try {
      const { api, created } = await test.step("the owner creates a team and a team key", async () => {
        const createdTeam = await createTeamThroughSession(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-stale-${suffix}`, organizationId: createdTeam.id });
        clients.push(client);

        return { api: client, created: createdTeam };
      });

      await test.step("a teammate joins as an admin and opens the team's projects", async () => {
        await signUp(teammatePage, teammateEmail);
        const [invitation] = await readData<Invitation[]>(await inviteThroughKey(api, [teammateEmail], "admin"), 201);
        const accepted = await acceptThroughSession(teammatePage.request, await mintInvitationToken(api, invitation.id));
        expect(accepted.status(), await accepted.text()).toBe(200);
        await workIn(teammatePage, created.id);
        await teammateProjects.goto();
        await expect(teammateSwitcher.trigger(team)).toBeVisible({ timeout: 30_000 });
      });

      await test.step("the owner removes the teammate while their tab stays open", async () => {
        const removal = await api.delete(`v1/organization-members/${(await findMember(api, teammateEmail))?.id}`);
        expect(removal.status(), await removal.text()).toBe(204);
      });

      await test.step("the stale tab tries to create a project, and the tab leaves the team", async () => {
        await teammateProjects.createProject(projectName, { waitForClose: false });
        await expect(teammateSwitcher.trigger(team)).toBeHidden({ timeout: 30_000 });
      });

      await test.step("the project exists neither in the team nor in the teammate's personal account", async () => {
        const inTeam = (await readData<Project[]>(await api.get("v1/projects"))).map(project => project.name);
        await workInPersonalAccount(teammatePage);
        const inPersonal = (await readData<Project[]>(await teammatePage.request.get(`${PROXY_API_URL}/v1/projects`))).map(project => project.name);
        expect({ inTeam: inTeam.includes(projectName), inPersonal: inPersonal.includes(projectName) }).toEqual({ inTeam: false, inPersonal: false });
      });

      await test.step("the tab tells the teammate they are no longer in the team, rather than to try again", async () => {
        await expect(teammatePage.getByText(/no longer (a member|in)|removed from|not a member/i)).toBeVisible();
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(teammatePage);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });
});

test.describe("Names, budgets and invitations sent to the API", () => {
  test.use({ userType: "new" });
  test.setTimeout(5 * 60_000);

  test("a NUL character in a project's name or description, or in a key's name, is refused as bad input instead of failing the server", async ({
    page,
    playwright
  }) => {
    const { team, suffix } = createNames();
    const clients: APIRequestContext[] = [];

    try {
      const api = await test.step("the owner creates a team and a team key", async () => {
        const created = await createTeamThroughSession(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-nul-${suffix}`, organizationId: created.id });
        clients.push(client);

        return client;
      });

      await test.step("a team name holding a NUL character is refused with a 400", async () => {
        const response = await postTeam(page, `nul${NUL}${suffix}`);
        expect.soft(response.status(), await response.text()).toBe(400);
      });

      await test.step("a project name holding a NUL character is refused with a 400", async () => {
        const response = await api.post("v1/projects", { data: { data: { name: `nul${NUL}${suffix}` } } });
        expect.soft(response.status(), await response.text()).toBe(400);
      });

      await test.step("a project description holding a NUL character is refused with a 400", async () => {
        const response = await api.post("v1/projects", { data: { data: { name: `described-${suffix}`, description: `about${NUL}it` } } });
        expect.soft(response.status(), await response.text()).toBe(400);
      });

      await test.step("an API key name holding a NUL character is refused with a 400", async () => {
        const response = await api.post("v1/api-keys", { data: { data: { name: `key${NUL}${suffix}` } } });
        expect.soft(response.status(), await response.text()).toBe(400);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });

  test("a project name without a visible character is refused, as a team name is", async ({ page, playwright }) => {
    const { team, suffix } = createNames();
    const clients: APIRequestContext[] = [];

    try {
      const api = await test.step("the owner creates a team and a team key", async () => {
        const created = await createTeamThroughSession(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-blank-${suffix}`, organizationId: created.id });
        clients.push(client);

        return client;
      });

      await test.step("a team name of invisible characters is refused with a 400", async () => {
        const response = await postTeam(page, INVISIBLE_NAME);
        expect.soft(response.status(), await response.text()).toBe(400);
      });

      await test.step("a project name of spaces is refused with a 400", async () => {
        const response = await api.post("v1/projects", { data: { data: { name: "   " } } });
        expect.soft(response.status(), await response.text()).toBe(400);
      });

      await test.step("a project name of invisible characters is refused with a 400, leaving no blank project behind", async () => {
        const response = await api.post("v1/projects", { data: { data: { name: INVISIBLE_NAME } } });
        expect.soft(response.status(), await response.text()).toBe(400);

        const names = (await readData<Project[]>(await api.get("v1/projects"))).map(project => project.name);
        expect.soft(names).not.toContain(INVISIBLE_NAME);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });

  test("team names: blank, overlong and bidi-control names are refused, padded unicode and emoji names are kept trimmed, and a case variant of an own team is refused", async ({
    page
  }) => {
    const { suffix } = createNames();
    const caseName = `Case-${suffix}`;
    const unicodeName = `Équipe 🚀 ${suffix}`;
    const emojiName = "🚀🛰️";

    try {
      await test.step("blank, overlong and bidi-control names are refused with a 400", async () => {
        const refused = await Promise.all(["   ", "t".repeat(MAX_NAME_LENGTH + 1), `‮evil-${suffix}`].map(name => postTeam(page, name)));
        expect(refused.map(response => response.status())).toEqual([400, 400, 400]);
      });

      await test.step("a team is created, and a case variant of its name is refused as taken", async () => {
        await readData<Organization>(await postTeam(page, caseName), 201);
        await expectRefusal(await postTeam(page, caseName.toUpperCase()), { status: 409, code: "organization_name_taken" });
      });

      await test.step("a padded name of accented letters and an emoji is kept, trimmed, with a slug", async () => {
        const created = await readData<Organization>(await postTeam(page, `  ${unicodeName}  `), 201);
        expect(created.name).toBe(unicodeName);
        expect(created.slug).toMatch(/^[a-z0-9-]+$/);
      });

      await test.step("a name of emoji only is kept, with a slug of its own", async () => {
        const created = await readData<Organization>(await postTeam(page, emojiName), 201);
        expect(created.name).toBe(emojiName);
        expect(created.slug).toMatch(/^[a-z0-9-]+$/);
      });
    } finally {
      await deleteTeamsLeftBehind(page);
    }
  });

  test("project names and budgets: blank and overlong input and out-of-range budgets are refused, padded names are trimmed, and duplicates are refused even when sent at once", async ({
    page,
    playwright
  }) => {
    const { team, suffix } = createNames();
    const clients: APIRequestContext[] = [];

    try {
      const api = await test.step("the owner creates a team and a team key", async () => {
        const created = await createTeamThroughSession(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-inputs-${suffix}`, organizationId: created.id });
        clients.push(client);

        return client;
      });

      await test.step("an overlong name and an overlong description are refused with a 400", async () => {
        const refused = await Promise.all([
          api.post("v1/projects", { data: { data: { name: "p".repeat(MAX_NAME_LENGTH + 1) } } }),
          api.post("v1/projects", { data: { data: { name: `long-${suffix}`, description: "d".repeat(MAX_DESCRIPTION_LENGTH + 1) } } })
        ]);
        expect(refused.map(response => response.status())).toEqual([400, 400]);
      });

      const padded = await test.step("a padded name is kept trimmed, and its case variant is refused as taken", async () => {
        const created = await readData<Project>(await api.post("v1/projects", { data: { data: { name: `  padded-${suffix}  ` } } }), 201);
        expect(created.name).toBe(`padded-${suffix}`);
        await expectRefusal(await api.post("v1/projects", { data: { data: { name: `PADDED-${suffix}` } } }), { status: 409, code: "project_name_taken" });

        return created;
      });

      await test.step("names that read like app routes are kept as plain names", async () => {
        const created = await Promise.all(["new", "settings"].map(name => api.post("v1/projects", { data: { data: { name } } })));
        expect(created.map(response => response.status())).toEqual([201, 201]);
      });

      await test.step("budgets of zero, below zero, below a cent, and past the maximum are refused with a 400", async () => {
        const amounts = [0, -5, 1.001, 10_000_000.01, 1e12];
        const refused = await Promise.all(
          amounts.map(monthlyAmountUsd => api.post("v1/project-budgets", { data: { data: { projectId: padded.id, monthlyAmountUsd } } }))
        );
        expect(refused.map(response => response.status())).toEqual(amounts.map(() => 400));
      });

      await test.step("the maximum budget is kept to the cent, and an update to a fraction of a cent is refused", async () => {
        const budget = await readData<Budget>(
          await api.post("v1/project-budgets", { data: { data: { projectId: padded.id, monthlyAmountUsd: 10_000_000 } } }),
          201
        );
        expect(budget.monthlyAmountUsd).toBe(10_000_000);

        const updated = await readData<Budget>(await api.patch(`v1/project-budgets/${budget.id}`, { data: { data: { monthlyAmountUsd: 19.99 } } }));
        expect(updated.monthlyAmountUsd).toBe(19.99);
        expect((await api.patch(`v1/project-budgets/${budget.id}`, { data: { data: { monthlyAmountUsd: 0.005 } } })).status()).toBe(400);
      });

      await test.step("two budgets for one project sent at once leave one budget and one 409", async () => {
        const project = await readData<Project>(await api.post("v1/projects", { data: { data: { name: `budget-race-${suffix}` } } }), 201);
        const responses = await Promise.all(
          [25, 50].map(monthlyAmountUsd => api.post("v1/project-budgets", { data: { data: { projectId: project.id, monthlyAmountUsd } } }))
        );
        expect(statusesOf(responses)).toEqual([201, 409]);

        const budgets = await readData<Budget[]>(await api.get("v1/project-budgets", { params: { projectId: project.id } }));
        expect(budgets).toHaveLength(1);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });

  test("invitations: the caller's own address is refused in any case, and one address in several cases or sent twice at once gets one invitation", async ({
    page,
    playwright
  }) => {
    const { team, suffix } = createNames();
    const inbox = createInboxClient();
    const invitee = inbox.generateEmail();
    const [localPart, domain] = invitee.split("@");
    const taggedInvitee = `${localPart}+tag@${domain}`;
    const clients: APIRequestContext[] = [];

    try {
      const api = await test.step("the owner creates a team and a team key", async () => {
        const created = await createTeamThroughSession(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-invites-${suffix}`, organizationId: created.id });
        clients.push(client);

        return client;
      });

      await test.step("the owner's own address is refused as a member's, in its own case or in capitals", async () => {
        const { email } = await currentUserOf(page.request);
        await expectRefusal(await inviteThroughKey(api, [email]), { status: 409, code: "already_member" });
        await expectRefusal(await inviteThroughKey(api, [email.toUpperCase()]), { status: 409, code: "already_member" });
      });

      const invitation = await test.step("an address listed twice in two cases gets one invitation", async () => {
        const invited = await readData<Invitation[]>(await inviteThroughKey(api, [invitee, invitee.toUpperCase()]), 201);
        expect(invited.map(created => created.email)).toEqual([invitee]);

        return invited[0];
      });

      await test.step("the same address invited twice at once, in capitals, gets the invitation it already has", async () => {
        const responses = await Promise.all([inviteThroughKey(api, [invitee.toUpperCase()]), inviteThroughKey(api, [invitee])]);
        expect(responses.map(response => response.status())).toEqual([201, 201]);
        const invitationIds = await Promise.all(
          responses.map(async response => ((await response.json()) as { data: Invitation[] }).data.map(created => created.id))
        );
        expect(invitationIds).toEqual([[invitation.id], [invitation.id]]);
      });

      await test.step("a tagged form of the address is a separate invitation, and both are pending once", async () => {
        await readData<Invitation[]>(await inviteThroughKey(api, [taggedInvitee]), 201);
        const pending = await readData<Invitation[]>(await api.get("v1/organization-invitations"));
        expect(pending.map(pendingInvitation => pendingInvitation.email).sort()).toEqual([invitee, taggedInvitee].sort());
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });
});

test.describe("Creations racing each other", () => {
  test.use({ userType: "new" });
  test.setTimeout(6 * 60_000);

  test("teams and projects created at once: one per name, and never past the caps", async ({ page, playwright }) => {
    const { suffix } = createNames();
    const raceTeam = `e2e-race-${suffix}`;
    const clients: APIRequestContext[] = [];

    try {
      const firstTeam = await test.step("one team name sent twice at once leaves one team and one 409", async () => {
        const responses = await Promise.all([postTeam(page, raceTeam), postTeam(page, raceTeam)]);
        expect(statusesOf(responses)).toEqual([201, 409]);
        expect((await listOrganizations(page.request)).data.filter(organization => organization.name === raceTeam)).toHaveLength(1);

        return await organizationNamed(page, raceTeam);
      });

      await test.step("three teams sent at once by a person with one stop at the person's cap", async () => {
        const responses = await Promise.all([1, 2, 3].map(index => postTeam(page, `e2e-cap-${index}-${suffix}`)));
        const refusals = await refusalsOf(responses);
        const teams = (await listOrganizations(page.request)).data.filter(organization => organization.type === "team");

        expect(statusesOf(responses)).toEqual([201, 201, 403]);
        expect(refusals).toEqual([{ code: "organization_limit_reached", limit: teams.length }]);
      });

      const api = await test.step("the owner opens a key on the first team", async () => {
        const client = await openTeamKey(page, playwright, { name: `e2e-race-${suffix}`, organizationId: firstTeam.id });
        clients.push(client);

        return client;
      });

      await test.step("one project name sent twice at once leaves one project and one 409", async () => {
        const responses = await Promise.all([1, 2].map(() => api.post("v1/projects", { data: { data: { name: `race-${suffix}` } } })));
        expect(statusesOf(responses)).toEqual([201, 409]);
      });

      await test.step("projects sent at once past the team's cap stop exactly at it", async () => {
        for (const index of [1, 2, 3, 4, 5, 6]) {
          await readData<Project>(await api.post("v1/projects", { data: { data: { name: `fill-${index}-${suffix}` } } }), 201);
        }

        const responses = await Promise.all([1, 2, 3, 4].map(index => api.post("v1/projects", { data: { data: { name: `burst-${index}-${suffix}` } } })));
        const refusals = await refusalsOf(responses);
        const projects = await readData<Project[]>(await api.get("v1/projects"));

        expect(statusesOf(responses)).toEqual([201, 201, 403, 403]);
        expect(refusals).toEqual([
          { code: "project_limit_reached", limit: projects.length },
          { code: "project_limit_reached", limit: projects.length }
        ]);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });

  test("invitations and ownership changed at once: one membership per invitation, none through a revoked one, and exactly one owner", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { team, suffix } = createNames();
    const inbox = createInboxClient();
    const firstEmail = inbox.generateEmail();
    const secondEmail = inbox.generateEmail();
    const firstPage = await openSignedOutPage(browser);
    const secondPage = await openSignedOutPage(browser);
    const clients: APIRequestContext[] = [];

    try {
      const { api, created } = await test.step("the owner creates a team and a team key", async () => {
        const createdTeam = await createTeamThroughSession(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-owner-${suffix}`, organizationId: createdTeam.id });
        clients.push(client);

        return { api: client, created: createdTeam };
      });

      const people = await test.step("two people sign up for accounts of their own", async () => {
        const firstUser = await signUp(firstPage, firstEmail);
        const secondUser = await signUp(secondPage, secondEmail);

        return { firstUser, secondUser };
      });

      const firstToken = await test.step("the first person invited twice at once has one pending invitation", async () => {
        const responses = await Promise.all([inviteThroughKey(api, [firstEmail], "admin"), inviteThroughKey(api, [firstEmail], "admin")]);
        expect(responses.map(response => response.status())).toEqual([201, 201]);
        const pending = (await readData<Invitation[]>(await api.get("v1/organization-invitations"))).filter(invitation => invitation.email === firstEmail);
        expect(pending).toHaveLength(1);

        return await mintInvitationToken(api, pending[0].id);
      });

      await test.step("the invitation accepted twice at once makes one membership", async () => {
        const responses = await Promise.all([acceptThroughSession(firstPage.request, firstToken), acceptThroughSession(firstPage.request, firstToken)]);
        expect(responses.map(response => response.status())).toEqual([200, 200]);
        expect((await readData<Member[]>(await api.get("v1/organization-members"))).filter(member => member.email === firstEmail)).toHaveLength(1);
      });

      await test.step("the second person joins", async () => {
        const [invitation] = await readData<Invitation[]>(await inviteThroughKey(api, [secondEmail], "admin"), 201);
        const accepted = await acceptThroughSession(secondPage.request, await mintInvitationToken(api, invitation.id));
        expect(accepted.status(), await accepted.text()).toBe(200);
      });

      await test.step("ownership handed to both people at once leaves exactly one owner", async () => {
        const members = await readData<Member[]>(await api.get("v1/organization-members"));
        const targets = [firstEmail, secondEmail].map(email => members.find(member => member.email === email)?.id);
        const responses = await Promise.all(targets.map(id => api.post(`v1/organization-members/${id}/ownership-transfer`)));
        const after = await readData<Member[]>(await api.get("v1/organization-members"));

        expect(statusesOf(responses)).toEqual([200, 403]);
        expect(after.filter(member => member.role === "owner")).toHaveLength(1);
      });

      await test.step("the new owner hands the team back", async () => {
        const after = await readData<Member[]>(await api.get("v1/organization-members"));
        const newOwner = after.find(member => member.role === "owner");
        const newOwnerPage = newOwner?.userId === people.firstUser.id ? firstPage : secondPage;
        const owner = await currentUserOf(page.request);
        const ownerMember = after.find(member => member.userId === owner.id);
        await workIn(newOwnerPage, created.id);
        const handBack = await newOwnerPage.request.post(`${PROXY_API_URL}/v1/organization-members/${ownerMember?.id}/ownership-transfer`);
        expect(handBack.status(), await handBack.text()).toBe(200);
      });

      await test.step("an accept racing the owner's revoke joins only if the invitation was not revoked", async () => {
        const members = await readData<Member[]>(await api.get("v1/organization-members"));
        const removal = await api.delete(`v1/organization-members/${members.find(member => member.email === secondEmail)?.id}`);
        expect(removal.status(), await removal.text()).toBe(204);
        const [reinvited] = await readData<Invitation[]>(await inviteThroughKey(api, [secondEmail], "member"), 201);
        const token = await mintInvitationToken(api, reinvited.id);

        const [accept, revoke] = await Promise.all([
          acceptThroughSession(secondPage.request, token),
          api.delete(`v1/organization-invitations/${reinvited.id}`)
        ]);
        const joined = (await readData<Member[]>(await api.get("v1/organization-members"))).some(member => member.email === secondEmail);
        const preview = await readData<InvitationPreview>(await api.post("v1/invitations/preview", { data: { data: { token } } }));
        test.info().annotations.push({ type: "accept/revoke race", description: `accept ${accept.status()}, revoke ${revoke.status()}, joined ${joined}` });

        expect({ joined, status: preview.status }).toEqual(
          accept.status() === 200 ? { joined: true, status: "accepted" } : { joined: false, status: "revoked" }
        );
        expect.soft(revoke.status(), "a revoke that revoked nothing answered as if it had").toBe(joined ? 404 : 204);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(firstPage);
      await deleteTeamsLeftBehind(secondPage);
      await firstPage.context().close();
      await secondPage.context().close();
      await deleteAuth0UserQuietly(auth0, firstEmail);
      await deleteAuth0UserQuietly(auth0, secondEmail);
    }
  });
});

test.describe("Access that changes under a live session or key", () => {
  test.use({ userType: "new" });
  test.setTimeout(6 * 60_000);

  test("a demoted admin's key and session stop writing at once, a removed member's are refused at once, a key outlives its deleted project with no reach, and replaced or orphaned invitation links join nothing", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { team, suffix } = createNames();
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const clients: APIRequestContext[] = [];
    const openKey = async (keyHolder: Page, input: { name: string; organizationId: string; projectId?: string }) => {
      const client = await openTeamKey(keyHolder, playwright, input);
      clients.push(client);

      return client;
    };

    try {
      const { api, created, doomed } = await test.step("the owner creates a team with a project and a team key", async () => {
        const createdTeam = await createTeamThroughSession(page, team);
        const client = await openKey(page, { name: `e2e-owner-${suffix}`, organizationId: createdTeam.id });
        const project = await readData<Project>(await client.post("v1/projects", { data: { data: { name: `doomed-${suffix}` } } }), 201);

        return { api: client, created: createdTeam, doomed: project };
      });

      const projectKey = await test.step("the owner binds a second key to the project", async () => {
        return await openKey(page, { name: `e2e-bound-${suffix}`, organizationId: created.id, projectId: doomed.id });
      });

      const teammateKey = await test.step("a teammate joins as an admin and opens a team key", async () => {
        await signUp(teammatePage, teammateEmail);
        const [invitation] = await readData<Invitation[]>(await inviteThroughKey(api, [teammateEmail], "admin"), 201);
        const accepted = await acceptThroughSession(teammatePage.request, await mintInvitationToken(api, invitation.id));
        expect(accepted.status(), await accepted.text()).toBe(200);

        return await openKey(teammatePage, { name: `e2e-teammate-${suffix}`, organizationId: created.id });
      });

      await test.step("the admin's key and session create projects", async () => {
        await readData<Project>(await teammateKey.post("v1/projects", { data: { data: { name: `by-admin-key-${suffix}` } } }), 201);
        await readData<Project>(
          await teammatePage.request.post(`${PROXY_API_URL}/v1/projects`, { data: { data: { name: `by-admin-session-${suffix}` } } }),
          201
        );
      });

      await test.step("demoted to viewer, the admin's key and session read but no longer write", async () => {
        const member = await findMember(api, teammateEmail);
        await readData<Member>(await api.patch(`v1/organization-members/${member?.id}`, { data: { data: { role: "viewer", projectAccess: "all" } } }));

        expect((await teammateKey.post("v1/projects", { data: { data: { name: `by-viewer-key-${suffix}` } } })).status()).toBe(403);
        expect((await teammatePage.request.post(`${PROXY_API_URL}/v1/projects`, { data: { data: { name: `by-viewer-session-${suffix}` } } })).status()).toBe(
          403
        );
        expect((await teammateKey.get("v1/projects")).status()).toBe(200);
      });

      await test.step("removed, the teammate's key and session are refused at once", async () => {
        const member = await findMember(api, teammateEmail);
        const removal = await api.delete(`v1/organization-members/${member?.id}`);
        expect(removal.status(), await removal.text()).toBe(204);

        await expectRefusal(await teammateKey.get("v1/projects"), { status: 403, code: "organization_forbidden" });
        await expectRefusal(await teammatePage.request.get(`${PROXY_API_URL}/v1/projects`), { status: 403, code: "organization_forbidden" });
        await workInPersonalAccount(teammatePage);
      });

      await test.step("after its project is deleted, the bound key lists no project and reaches none", async () => {
        const deletion = await api.delete(`v1/projects/${doomed.id}`);
        expect(deletion.status(), await deletion.text()).toBe(204);

        expect(await readData<Project[]>(await projectKey.get("v1/projects"))).toEqual([]);
        expect((await projectKey.get(`v1/projects/${doomed.id}`)).status()).toBe(404);
        expect((await projectKey.post("v1/project-budgets", { data: { data: { projectId: doomed.id, monthlyAmountUsd: 10 } } })).status()).toBe(404);
      });

      const lastToken = await test.step("a link replaced by a resend previews and joins nothing", async () => {
        const [invitation] = await readData<Invitation[]>(await inviteThroughKey(api, [teammateEmail], "member"), 201);
        const replacedToken = await mintInvitationToken(api, invitation.id);
        const resend = await api.post(`v1/organization-invitations/${invitation.id}/resend`);
        expect(resend.status(), await resend.text()).toBe(200);

        expect((await api.post("v1/invitations/preview", { data: { data: { token: replacedToken } } })).status()).toBe(404);
        expect((await acceptThroughSession(teammatePage.request, replacedToken)).status()).toBe(404);

        return await mintInvitationToken(api, invitation.id);
      });

      await test.step("a link to a team deleted since joins nothing", async () => {
        await workIn(page, created.id);
        const deletion = await page.request.delete(`${PROXY_API_URL}/v1/organizations/${created.id}`);
        expect(deletion.status(), await deletion.text()).toBe(204);

        expect((await acceptThroughSession(teammatePage.request, lastToken)).status()).toBe(404);
        expect((await listOrganizations(teammatePage.request)).data.map(organization => organization.id)).not.toContain(created.id);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(teammatePage);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });

  test("a person can join a team named like one of theirs ignoring case, and still cannot create a third under that name", async ({
    page,
    browser,
    playwright,
    auth0
  }) => {
    const { suffix } = createNames();
    const ownerTeam = `Dup-${suffix}`;
    const inbox = createInboxClient();
    const teammateEmail = inbox.generateEmail();
    const teammatePage = await openSignedOutPage(browser);
    const clients: APIRequestContext[] = [];

    try {
      const api = await test.step("the owner creates a team and a team key", async () => {
        const created = await createTeamThroughSession(page, ownerTeam);
        const client = await openTeamKey(page, playwright, { name: `e2e-dup-${suffix}`, organizationId: created.id });
        clients.push(client);

        return client;
      });

      await test.step("a teammate signs up and creates a team of their own under the same name in lower case", async () => {
        await signUp(teammatePage, teammateEmail);
        await readData<Organization>(await postTeam(teammatePage, ownerTeam.toLowerCase()), 201);
        await expectRefusal(await postTeam(teammatePage, ownerTeam), { status: 409, code: "organization_name_taken" });
      });

      await test.step("the teammate accepts the owner's invitation although its name matches their own team's", async () => {
        const [invitation] = await readData<Invitation[]>(await inviteThroughKey(api, [teammateEmail], "member"), 201);
        const accepted = await acceptThroughSession(teammatePage.request, await mintInvitationToken(api, invitation.id));
        expect(accepted.status(), await accepted.text()).toBe(200);
      });

      await test.step("the teammate belongs to both teams and still cannot create a third under that name", async () => {
        const names = (await listOrganizations(teammatePage.request)).data.map(organization => organization.name.toLowerCase());
        expect(names.filter(name => name === ownerTeam.toLowerCase())).toHaveLength(2);
        await expectRefusal(await postTeam(teammatePage, ownerTeam.toUpperCase()), { status: 409, code: "organization_name_taken" });
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
      await deleteTeamsLeftBehind(teammatePage);
      await teammatePage.context().close();
      await deleteAuth0UserQuietly(auth0, teammateEmail);
    }
  });
});

test.describe("Ids of another team", () => {
  test.use({ userType: "new" });
  test.setTimeout(5 * 60_000);

  test("one team's key and session reach nothing of another team by its ids, its header or its cookie, even for a person in both", async ({
    page,
    playwright
  }) => {
    const { team, suffix } = createNames();
    const otherTeam = `e2e-other-${suffix}`;
    const inbox = createInboxClient();
    const clients: APIRequestContext[] = [];

    try {
      const { api, home } = await test.step("the owner creates a first team and a key on it", async () => {
        const created = await createTeamThroughSession(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-home-${suffix}`, organizationId: created.id });
        clients.push(client);

        return { api: client, home: created };
      });

      const foreign = await test.step("the owner creates a second team with a project, a budget and a pending invitation", async () => {
        const created = await createTeamThroughSession(page, otherTeam);
        const client = await openTeamKey(page, playwright, { name: `e2e-other-${suffix}`, organizationId: created.id });
        clients.push(client);
        const project = await readData<Project>(await client.post("v1/projects", { data: { data: { name: `foreign-${suffix}` } } }), 201);
        const budget = await readData<Budget>(
          await client.post("v1/project-budgets", { data: { data: { projectId: project.id, monthlyAmountUsd: 10 } } }),
          201
        );
        const [invitation] = await readData<Invitation[]>(await inviteThroughKey(client, [inbox.generateEmail()], "member"), 201);
        const ownerMember = (await readData<Member[]>(await client.get("v1/organization-members")))[0];

        return { organization: created, project, budget, invitation, ownerMember };
      });

      await test.step("the first team's key answers 404 for the second team's project, budget, invitation and member", async () => {
        const responses = await Promise.all([
          api.get(`v1/projects/${foreign.project.id}`),
          api.patch(`v1/projects/${foreign.project.id}`, { data: { data: { name: `renamed-${suffix}` } } }),
          api.delete(`v1/projects/${foreign.project.id}`),
          api.get(`v1/projects/${foreign.project.id}/members`),
          api.patch(`v1/project-budgets/${foreign.budget.id}`, { data: { data: { monthlyAmountUsd: 20 } } })
        ]);
        expect(responses.map(response => response.status())).toEqual([404, 404, 404, 404, 404]);

        const more = await Promise.all([
          api.delete(`v1/project-budgets/${foreign.budget.id}`),
          api.post(`v1/organization-invitations/${foreign.invitation.id}/resend`),
          api.post(`v1/organization-invitations/${foreign.invitation.id}/link`),
          api.delete(`v1/organization-invitations/${foreign.invitation.id}`),
          api.patch(`v1/organization-members/${foreign.ownerMember.id}`, { data: { data: { role: "admin" } } })
        ]);
        expect(more.map(response => response.status())).toEqual([404, 404, 404, 404, 404]);

        const last = await Promise.all([
          api.post(`v1/organization-members/${foreign.ownerMember.id}/ownership-transfer`),
          api.get(`v1/organization-members/${foreign.ownerMember.id}/project-grants`),
          api.delete(`v1/organization-members/${foreign.ownerMember.id}`),
          api.patch(`v1/organizations/${foreign.organization.id}`, { data: { data: { name: `renamed-${suffix}` } } })
        ]);
        expect(last.map(response => response.status())).toEqual([404, 404, 404, 404]);
      });

      await test.step("the first team's key cannot file a budget, a grant, an invitation or a key under the second team's project", async () => {
        const responses = await Promise.all([
          api.post("v1/project-budgets", { data: { data: { projectId: foreign.project.id, monthlyAmountUsd: 10 } } }),
          api.post("v1/organization-invitations", {
            data: { data: { emails: [inbox.generateEmail()], role: "member", projectGrants: [{ projectId: foreign.project.id, role: "member" }] } }
          }),
          api.post("v1/api-keys", { data: { data: { name: `e2e-cross-${suffix}`, projectId: foreign.project.id } } })
        ]);
        expect(responses.map(response => response.status())).toEqual([404, 400, 403]);
        expect(await readData<Budget[]>(await api.get("v1/project-budgets", { params: { projectId: foreign.project.id } }))).toEqual([]);
        expect(await readData<unknown[]>(await api.get("v1/organization-activities", { params: { projectId: foreign.project.id } }))).toEqual([]);
      });

      await test.step("the first team's key refuses headers naming the second team or its project", async () => {
        await expectRefusal(await api.get("v1/projects", { headers: { "x-organization-id": foreign.organization.id } }), {
          status: 400,
          code: "organization_mismatch"
        });
        await expectRefusal(await api.get("v1/projects", { headers: { "x-project-id": foreign.project.id } }), { status: 403, code: "project_forbidden" });
      });

      await test.step("a session working in the first team cannot delete or leave the second team by its id", async () => {
        await workIn(page, home.id);
        const responses = await Promise.all([
          page.request.delete(`${PROXY_API_URL}/v1/organizations/${foreign.organization.id}`),
          page.request.delete(`${PROXY_API_URL}/v1/organizations/${foreign.organization.id}/membership`)
        ]);
        expect(responses.map(response => response.status())).toEqual([404, 404]);
      });

      await test.step("a cookie naming an organization the person is not in is refused, with no data", async () => {
        await workIn(page, crypto.randomUUID());
        await expectRefusal(await page.request.get(`${PROXY_API_URL}/v1/projects`), { status: 403, code: "organization_forbidden" });
        await workIn(page, "not-a-team-of-mine");
        await expectRefusal(await page.request.get(`${PROXY_API_URL}/v1/projects`), { status: 403, code: "organization_forbidden" });
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });
});

test.describe("Latency of an organization's reads", () => {
  test.use({ userType: "new" });
  test.setTimeout(6 * 60_000);

  test("a team key reads the organization, its projects, members, activity and spend, and the app switches teams, each within a second", async ({
    page,
    playwright
  }) => {
    const { team, suffix } = createNames();
    const secondTeam = `e2e-team-b-${suffix}`;
    const clients: APIRequestContext[] = [];
    const slow: string[] = [];
    const record = (label: string, samples: number[]) => {
      const summary = summarize(samples);
      test.info().annotations.push({ type: "latency", description: `${label}: p50 ${summary.p50} ms, p95 ${summary.p95} ms, n=${samples.length}` });
      if (summary.p95 > SLOW_RESPONSE_MS) slow.push(`${label} p95 ${summary.p95} ms`);
    };

    try {
      const api = await test.step("the owner creates a team with two projects and a team key", async () => {
        await createTeam(page, team);
        const created = await organizationNamed(page, team);
        const client = await openTeamKey(page, playwright, { name: `e2e-latency-${suffix}`, organizationId: created.id });
        clients.push(client);
        await readData<Project>(await client.post("v1/projects", { data: { data: { name: `one-${suffix}` } } }), 201);
        await readData<Project>(await client.post("v1/projects", { data: { data: { name: `two-${suffix}` } } }), 201);

        return client;
      });

      await test.step("the key reads each route ten times in a row", async () => {
        for (const path of [
          "v1/organizations",
          "v1/projects",
          "v1/organization-members",
          "v1/organization-activities",
          "v1/project-spend",
          "v1/deployment-spend"
        ]) {
          record(path, await timeSequentialReads(api, path));
        }
      });

      await test.step("the app switches between two teams and lands on the team's projects", async () => {
        await createTeamThroughSession(page, secondTeam);
        const projects = new ProjectsPage(page);
        const switcher = new OrganizationSwitcher(page);
        await projects.goto();
        await expect(switcher.trigger(team)).toBeVisible({ timeout: 30_000 });
        const samples: number[] = [];

        for (const target of Array.from({ length: SWITCH_SAMPLES * 2 }, (_, index) => (index % 2 === 0 ? secondTeam : team))) {
          const startedAt = Date.now();
          await switcher.switchTo(target);
          await expect(switcher.trigger(target)).toBeVisible({ timeout: 30_000 });
          await expect(projects.heading()).toBeVisible({ timeout: 30_000 });
          samples.push(Date.now() - startedAt);
        }

        record("switch team to its projects (UI)", samples);
      });

      await test.step("no read or switch took more than a second at the 95th percentile", async () => {
        expect(slow).toEqual([]);
      });
    } finally {
      await Promise.all(clients.map(client => client.dispose()));
      await deleteTeamsLeftBehind(page);
    }
  });
});

async function readData<T>(response: APIResponse, status = 200): Promise<T> {
  expect(response.status(), await response.text()).toBe(status);

  return ((await response.json()) as { data: T }).data;
}

async function expectRefusal(response: APIResponse, expected: { status: number; code: string }) {
  expect(response.status(), await response.text()).toBe(expected.status);
  expect(((await response.json()) as ApiError).code).toBe(expected.code);
}

function statusesOf(responses: APIResponse[]): number[] {
  return responses.map(response => response.status()).sort((a, b) => a - b);
}

async function refusalsOf(responses: APIResponse[]) {
  const refused = responses.filter(response => response.status() >= 400);

  return await Promise.all(
    refused.map(async response => {
      const error = (await response.json()) as ApiError;

      return { code: error.code, limit: error.data?.limit };
    })
  );
}

async function currentUserOf(request: APIRequestContext): Promise<CurrentUser> {
  return await readData<CurrentUser>(await request.get(`${PROXY_API_URL}/v1/user/me`));
}

/** Signs the person up by email code, which leaves their address verified as an invitation expects. */
async function signUp(page: Page, email: string): Promise<CurrentUser> {
  await page.goto(`${testEnvConfig.BASE_URL}/login`);
  await signInPasswordless(page, email);
  await acceptFairUsePolicyIfPrompted(page);

  return await currentUserOf(page.request);
}

async function postTeam(page: Page, name: string): Promise<APIResponse> {
  return await page.request.post(`${PROXY_API_URL}/v1/organizations`, { data: { data: { name } } });
}

/** Creating a team leaves the session working where it was, since the app's proxy takes the organization from its cookie only. */
async function createTeamThroughSession(page: Page, name: string): Promise<Organization> {
  return await readData<Organization>(await postTeam(page, name), 201);
}

async function organizationNamed(page: Page, name: string): Promise<Organization> {
  const organization = (await listOrganizations(page.request)).data.find(candidate => candidate.name === name);
  expect(organization, `no organization named ${name}`).toBeDefined();

  return organization as Organization;
}

async function workIn(page: Page, organizationId: string) {
  await page.context().addCookies([{ name: ACTIVE_ORGANIZATION_COOKIE, value: organizationId, url: testEnvConfig.BASE_URL }]);
}

async function workInPersonalAccount(page: Page) {
  await page.context().clearCookies({ name: ACTIVE_ORGANIZATION_COOKIE });
}

/** A key is bound to the organization its session works in when it is created. */
async function openTeamKey(page: Page, playwright: Playwright, input: { name: string; organizationId: string; projectId?: string }) {
  await workIn(page, input.organizationId);
  const created = await createApiKey(page.request, { name: input.name, projectId: input.projectId });
  expect(created.organizationId).toBe(input.organizationId);

  return await openApiKeyClient(playwright, created.apiKey);
}

/** Lists through the session, which then keeps working in the organization it listed. */
async function projectNamesIn(page: Page, organizationId: string): Promise<string[]> {
  await workIn(page, organizationId);

  return (await readData<Project[]>(await page.request.get(`${PROXY_API_URL}/v1/projects`))).map(project => project.name);
}

async function inviteThroughKey(api: APIRequestContext, emails: string[], role: "admin" | "member" = "member"): Promise<APIResponse> {
  return await api.post("v1/organization-invitations", { data: { data: { emails, role, ...(role === "member" && { projectAccess: "all" }) } } });
}

/** A new link retires every earlier one, so the token is read from the link the api returns. */
async function mintInvitationToken(api: APIRequestContext, invitationId: string): Promise<string> {
  const { url } = await readData<{ url: string }>(await api.post(`v1/organization-invitations/${invitationId}/link`));
  const token = new URLSearchParams(new URL(url).hash.slice(1)).get("token");
  expect(token).toBeTruthy();

  return token as string;
}

async function acceptThroughSession(request: APIRequestContext, token: string): Promise<APIResponse> {
  return await request.post(`${PROXY_API_URL}/v1/invitations/accept`, { data: { data: { token } } });
}

async function findMember(api: APIRequestContext, email: string): Promise<Member | undefined> {
  return (await readData<Member[]>(await api.get("v1/organization-members"))).find(member => member.email === email);
}

async function timeSequentialReads(api: APIRequestContext, path: string): Promise<number[]> {
  const samples: number[] = [];

  for (let read = 0; read < LATENCY_SAMPLES; read++) {
    const startedAt = performance.now();
    const response = await api.get(path);
    samples.push(Math.round(performance.now() - startedAt));
    expect(response.status(), `${path}: ${await response.text()}`).toBe(200);
  }

  return samples;
}

/** Nearest-rank percentiles, so with ten samples the 95th is the slowest one. */
function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (percentile: number) => sorted[Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)];

  return { p50: at(50), p95: at(95) };
}
