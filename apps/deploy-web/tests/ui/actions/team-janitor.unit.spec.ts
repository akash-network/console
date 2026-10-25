import type { APIRequestContext, APIResponse, BrowserContext, Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACTIVE_ORGANIZATION_COOKIE, deleteOwnedTeams } from "./team-janitor";

const BASE_URL = "https://console.test";
const ORGANIZATIONS_URL = `${BASE_URL}/api/proxy/v1/organizations`;

type ListedOrganization = { id: string; type: "personal" | "team"; role: string };

describe(deleteOwnedTeams.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes every team the account owns and leaves its personal account and the teams it only belongs to", async () => {
    const { page, request, warn } = setup({
      organizations: [ownedTeam("personal-1", "personal"), ownedTeam("team-a"), { id: "team-b", type: "team", role: "member" }, ownedTeam("team-c")]
    });

    await deleteOwnedTeams(page, BASE_URL);

    expect(request.delete.mock.calls.map(([url]) => url)).toEqual([`${ORGANIZATIONS_URL}/team-a`, `${ORGANIZATIONS_URL}/team-c`]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("works in each team while deleting it and ends back in the personal account", async () => {
    const { page, context } = setup({ organizations: [ownedTeam("team-a")] });

    await deleteOwnedTeams(page, BASE_URL);

    expect(context.addCookies).toHaveBeenCalledWith([{ name: ACTIVE_ORGANIZATION_COOKIE, value: "team-a", url: BASE_URL }]);
    expect(context.clearCookies).toHaveBeenLastCalledWith({ name: ACTIVE_ORGANIZATION_COOKIE });
  });

  it("forfeits the balance a team still holds when the first delete is refused over it", async () => {
    const { page, request, warn } = setup({ organizations: [ownedTeam("team-a")] });
    request.delete.mockResolvedValueOnce(jsonResponse(409, { data: { balanceUsd: 12.5 } }));

    await deleteOwnedTeams(page, BASE_URL);

    expect(request.delete).toHaveBeenLastCalledWith(`${ORGANIZATIONS_URL}/team-a`, {
      params: { acknowledgedForfeitUsd: 12.5 },
      failOnStatusCode: false
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps deleting the other teams when a request for one of them fails, and warns with the team left behind", async () => {
    const { page, request, warn } = setup({ organizations: [ownedTeam("team-a"), ownedTeam("team-c")] });
    request.delete.mockRejectedValueOnce(new Error("socket hang up"));

    await expect(deleteOwnedTeams(page, BASE_URL)).resolves.toBeUndefined();

    expect(request.delete).toHaveBeenCalledWith(`${ORGANIZATIONS_URL}/team-c`, { failOnStatusCode: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("team-a (socket hang up)"));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("team-c"));
  });

  it("warns with the status of a refusal that carries no balance to forfeit", async () => {
    const { page, request, warn } = setup({ organizations: [ownedTeam("team-a")] });
    request.delete.mockResolvedValueOnce(jsonResponse(500, { message: "Internal Server Error" }));

    await deleteOwnedTeams(page, BASE_URL);

    expect(request.delete).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("team-a (HTTP 500)"));
  });

  it("warns with the status when the forfeit is refused too", async () => {
    const { page, request, warn } = setup({ organizations: [ownedTeam("team-a")] });
    request.delete.mockResolvedValueOnce(jsonResponse(409, { data: { balanceUsd: 3 } })).mockResolvedValueOnce(jsonResponse(403, {}));

    await deleteOwnedTeams(page, BASE_URL);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("team-a (HTTP 403)"));
  });

  it("deletes nothing and warns when the account's organizations cannot be listed", async () => {
    const { page, request, warn } = setup({ organizations: [ownedTeam("team-a")], listStatus: 401 });

    await expect(deleteOwnedTeams(page, BASE_URL)).resolves.toBeUndefined();

    expect(request.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 401"));
  });

  function setup(input: { organizations: ListedOrganization[]; listStatus?: number }) {
    const request = mock<APIRequestContext>();
    request.get.mockImplementation(async url =>
      url === ORGANIZATIONS_URL ? jsonResponse(input.listStatus ?? 200, { data: input.organizations }) : jsonResponse(200, { data: { deployments: [] } })
    );
    request.delete.mockResolvedValue(jsonResponse(204, {}));

    const context = mock<BrowserContext>();
    context.addCookies.mockResolvedValue(undefined);
    context.clearCookies.mockResolvedValue(undefined);
    const page = Object.assign(mock<Page>(), { request });
    page.context.mockReturnValue(context);
    page.waitForTimeout.mockResolvedValue(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    return { page, request, context, warn };
  }

  function ownedTeam(id: string, type: ListedOrganization["type"] = "team"): ListedOrganization {
    return { id, type, role: "owner" };
  }

  function jsonResponse(status: number, body: unknown) {
    return mock<APIResponse>({
      ok: () => status >= 200 && status < 300,
      status: () => status,
      json: () => Promise.resolve(body)
    });
  }
});
