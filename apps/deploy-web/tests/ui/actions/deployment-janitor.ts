import type { APIResponse, Page } from "@playwright/test";

/** Two consecutive empty listings before the account is declared clean, so a create still landing on chain is caught. */
const REQUIRED_CLEAN_PASSES = 2;
const MAX_PASSES = 4;
const PASS_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 60_000;

type DeploymentListEntry = { deployment?: { id?: { dseq?: string } } };
type DeploymentListBody = { data?: { deployments?: DeploymentListEntry[] } };

/**
 * Closes every deployment still active on the account the page is signed in as, and returns the dseqs it closed.
 *
 * `GET /v1/deployments` answers with the caller's *active* deployments only, and the app's own proxy signs the call
 * with the browser session's access token, so this needs no credentials of its own. `DELETE` on the same resource is
 * idempotent server-side, so re-closing costs nothing.
 *
 * Never throws: it runs as teardown, where raising a cleanup hiccup would bury the failure that actually matters. A
 * deployment it could not close is warned about instead, since that one has to be reclaimed by hand.
 */
export async function closeAllActiveDeployments(page: Page, baseUrl: string): Promise<string[]> {
  const endpoint = `${baseUrl}/api/proxy/v1/deployments`;
  const closed = new Set<string>();
  const failures = new Map<string, string>();
  let cleanPasses = 0;

  for (let pass = 0; pass < MAX_PASSES && cleanPasses < REQUIRED_CLEAN_PASSES; pass++) {
    if (pass > 0) await page.waitForTimeout(PASS_DELAY_MS);

    const active = await listActiveDseqs(page, endpoint);
    if (!active) break;

    forgetFailuresGoneFromTheAccount(active, failures);

    if (active.length === 0) {
      cleanPasses++;
      continue;
    }

    cleanPasses = 0;
    for (const dseq of active.filter(dseq => !closed.has(dseq))) {
      const failure = await closeDeployment(page, endpoint, dseq);

      if (failure) {
        failures.set(dseq, failure);
      } else {
        closed.add(dseq);
        failures.delete(dseq);
      }
    }
  }

  if (failures.size) {
    const details = [...failures].map(([dseq, failure]) => `${dseq} (${failure})`).join(", ");
    console.warn(`[deployment-janitor] still active and needs a manual close: ${details}`);
  }

  return [...closed];
}

/**
 * Drops a close whose response never confirmed it once the account stops listing that dseq, so the run does not end
 * by pointing at a deployment that is already gone. One absent listing is not proof the close landed, which is why
 * the dseq is not recorded as closed either: should it come back, it has to be eligible for another attempt.
 */
function forgetFailuresGoneFromTheAccount(active: string[], failures: Map<string, string>) {
  for (const dseq of failures.keys()) {
    if (!active.includes(dseq)) failures.delete(dseq);
  }
}

/** Returns the active dseqs, or `null` when the account cannot be read at all (no session, proxy unreachable, unusable body). */
async function listActiveDseqs(page: Page, endpoint: string): Promise<string[] | null> {
  const response = await request(page, "get", endpoint);

  if (!response?.ok()) {
    console.warn(`[deployment-janitor] could not list active deployments: ${describeFailure(response)}`);
    return null;
  }

  const body = (await response.json().catch(() => null)) as DeploymentListBody | null;

  if (!body) {
    console.warn(`[deployment-janitor] could not read the active deployments listing: HTTP ${response.status()} carried no JSON`);
    return null;
  }

  const deployments = body.data?.deployments ?? [];

  if (!Array.isArray(deployments)) {
    console.warn(`[deployment-janitor] could not read the active deployments listing: the deployments field was not a list`);
    return null;
  }

  return deployments.map(entry => entry?.deployment?.id?.dseq).filter((dseq): dseq is string => !!dseq);
}

/** Returns a description of why the close failed, or `undefined` once the deployment is closed. */
async function closeDeployment(page: Page, endpoint: string, dseq: string): Promise<string | undefined> {
  const response = await request(page, "delete", `${endpoint}/${dseq}`);

  return response?.ok() ? undefined : describeFailure(response);
}

function request(page: Page, method: "get" | "delete", url: string) {
  return page.request[method](url, { failOnStatusCode: false, timeout: REQUEST_TIMEOUT_MS }).catch(() => null);
}

function describeFailure(response: APIResponse | null) {
  return response ? `HTTP ${response.status()}` : "request failed";
}
