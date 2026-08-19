import type { APIResponse, Page } from "@playwright/test";

/** Two consecutive clean listings before the account is declared clean, so a create still landing on chain is caught. */
const REQUIRED_CLEAN_PASSES = 2;
const MAX_PASSES = 4;
const PASS_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 60_000;

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

    const pending = active.filter(dseq => !closed.has(dseq));
    if (pending.length === 0) {
      cleanPasses++;
      continue;
    }

    cleanPasses = 0;
    for (const dseq of pending) {
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

/** Returns the active dseqs, or `null` when the account cannot be read at all (no session, proxy unreachable). */
async function listActiveDseqs(page: Page, endpoint: string): Promise<string[] | null> {
  const response = await request(page, "get", endpoint);

  if (!response?.ok()) {
    console.warn(`[deployment-janitor] could not list active deployments: ${describeFailure(response)}`);
    return null;
  }

  const body = (await response.json()) as { data?: { deployments?: { deployment?: { id?: { dseq?: string } } }[] } };

  return (body.data?.deployments ?? []).map(({ deployment }) => deployment?.id?.dseq).filter((dseq): dseq is string => !!dseq);
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
