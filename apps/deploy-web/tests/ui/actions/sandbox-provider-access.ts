import type { APIRequestContext, Page } from "@playwright/test";

import { expect } from "../fixture/base-test";
import { testEnvConfig } from "../fixture/test-env.config";
import { listOrganizations, PROXY_API_URL } from "./organization";
import type { SandboxProviderGrantDependencies } from "./sandbox-provider-grant";
import { connectGranter, grantSandboxProviderAccess, isSandboxProviderAccessEnabled } from "./sandbox-provider-grant";

const WALLET_PROVISIONING_TIMEOUT_MS = 120_000;
const WALLET_POLL_INTERVALS_MS = [1_000, 2_000, 5_000];

type CurrentUser = { data: { id: string } };
type WalletList = { data: { address: string | null }[] };

const GRANT_DEPENDENCIES: SandboxProviderGrantDependencies = {
  networkId: testEnvConfig.NETWORK_ID,
  granterMnemonic: testEnvConfig.E2E_SANDBOX_PROVIDER_GRANTER_MNEMONIC,
  connect: connectGranter,
  now: () => new Date()
};

/** Lets the signed-in account deploy on the sandbox provider; with an organization it is the team's wallet that pays, so that one gets the grant. */
export async function allowAccountOnSandboxProvider(request: APIRequestContext, options: { organizationId?: string } = {}) {
  if (!isSandboxProviderAccessEnabled(GRANT_DEPENDENCIES)) return;

  await grantSandboxProviderAccess(await waitForWalletAddress(request, options.organizationId), GRANT_DEPENDENCIES);
}

export async function allowTeamOnSandboxProvider(page: Page, team: string) {
  if (!isSandboxProviderAccessEnabled(GRANT_DEPENDENCIES)) return;

  const organization = (await listOrganizations(page.request)).data.find(candidate => candidate.type === "team" && candidate.name === team);
  expect(organization, `team ${team} is not among the user's organizations`).toBeDefined();
  await allowAccountOnSandboxProvider(page.request, { organizationId: organization!.id });
}

/** A personal wallet stays hidden until the trial provisioning job activates it, a few seconds after sign-up. */
async function waitForWalletAddress(request: APIRequestContext, organizationId: string | undefined) {
  const headers = organizationId ? { "x-organization-id": organizationId } : undefined;
  const me = (await (await request.get(`${PROXY_API_URL}/v1/user/me`, { headers })).json()) as CurrentUser;
  let address: string | null | undefined;

  await expect
    .poll(
      async () => {
        const response = await request.get(`${PROXY_API_URL}/v1/wallets`, { params: { userId: me.data.id }, headers });
        address = response.ok() ? ((await response.json()) as WalletList).data[0]?.address : undefined;
        return address;
      },
      { timeout: WALLET_PROVISIONING_TIMEOUT_MS, intervals: WALLET_POLL_INTERVALS_MS, message: "the account's wallet never showed an address" }
    )
    .toBeTruthy();

  return address!;
}
