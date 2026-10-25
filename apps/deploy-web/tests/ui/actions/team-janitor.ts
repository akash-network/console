import type { Page } from "@playwright/test";

import { closeAllActiveDeployments } from "./deployment-janitor";

/** The app's proxy takes the organization a request runs in from this cookie only. */
export const ACTIVE_ORGANIZATION_COOKIE = "console_org";

type OrganizationListBody = { data?: { id: string; type: string; role: string }[] };

type DeletionRefusalBody = { data?: { balanceUsd?: number } };

/** Never throws, since it runs as teardown: a team it cannot delete is warned about and the next one is still deleted. */
export async function deleteOwnedTeams(page: Page, baseUrl: string): Promise<void> {
  const organizationsUrl = `${baseUrl}/api/proxy/v1/organizations`;
  const failures = new Map<string, string>();

  try {
    await page.context().clearCookies({ name: ACTIVE_ORGANIZATION_COOKIE });
    for (const id of await listOwnedTeamIds(page, organizationsUrl)) {
      const failure = await deleteOwnedTeam(page, { baseUrl, teamUrl: `${organizationsUrl}/${id}`, id }).catch(describeError);
      if (failure) failures.set(id, failure);
    }
  } catch (error) {
    console.warn(`[team-janitor] gave up deleting the account's teams: ${describeError(error)}`);
  } finally {
    await page
      .context()
      .clearCookies({ name: ACTIVE_ORGANIZATION_COOKIE })
      .catch(() => undefined);
  }

  if (failures.size) {
    const details = [...failures].map(([id, failure]) => `${id} (${failure})`).join(", ");
    console.warn(`[team-janitor] still exists and needs a manual delete: ${details}`);
  }
}

async function listOwnedTeamIds(page: Page, organizationsUrl: string): Promise<string[]> {
  const response = await page.request.get(organizationsUrl);
  if (!response.ok()) throw new Error(`listing organizations answered HTTP ${response.status()}`);
  const { data = [] } = (await response.json()) as OrganizationListBody;

  return data.filter(organization => organization.type === "team" && organization.role === "owner").map(organization => organization.id);
}

/** Answers what kept the team from being deleted, or nothing once it is gone. */
async function deleteOwnedTeam(page: Page, input: { baseUrl: string; teamUrl: string; id: string }): Promise<string | undefined> {
  await page.context().addCookies([{ name: ACTIVE_ORGANIZATION_COOKIE, value: input.id, url: input.baseUrl }]);
  await closeAllActiveDeployments(page, input.baseUrl);

  const refusal = await page.request.delete(input.teamUrl, { failOnStatusCode: false });
  if (refusal.ok()) return;

  const balanceUsd = ((await refusal.json().catch(() => ({}))) as DeletionRefusalBody).data?.balanceUsd;
  if (!balanceUsd) return `HTTP ${refusal.status()}`;

  const forfeit = await page.request.delete(input.teamUrl, { params: { acknowledgedForfeitUsd: balanceUsd }, failOnStatusCode: false });

  return forfeit.ok() ? undefined : `HTTP ${forfeit.status()}`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
