import { fetchAllowingSelfSignedCerts } from "@src/shared/utils/fetch";

const AKASH_ADDRESS = /^akash1[02-9ac-hj-np-z]{38}$/;

export class ProviderIdentityMismatchError extends Error {
  constructor(
    readonly hostUri: string,
    readonly owner: string,
    readonly reportedOwner: string
  ) {
    super(`Provider endpoint ${hostUri} answers as ${reportedOwner}, not ${owner}`);
    this.name = "ProviderIdentityMismatchError";
  }
}

/** An endpoint that answers as another owner reports that owner's cluster, so its status must not be stored as this provider's. */
export async function assertEndpointNotOwnedByAnotherProvider({
  owner,
  hostUri,
  timeoutMs,
  fetchProvider = fetchAllowingSelfSignedCerts
}: {
  owner: string;
  hostUri: string;
  timeoutMs: number;
  fetchProvider?: typeof fetchAllowingSelfSignedCerts;
}): Promise<void> {
  const response = await fetchProvider(`${hostUri}/address`, { signal: AbortSignal.timeout(timeoutMs) });

  if (!response.ok) return;

  const reportedOwner = await readReportedOwner(response);

  if (reportedOwner && reportedOwner !== owner && AKASH_ADDRESS.test(reportedOwner)) {
    throw new ProviderIdentityMismatchError(hostUri, owner, reportedOwner);
  }
}

async function readReportedOwner(response: Response): Promise<string | undefined> {
  const body: unknown = await response.json().catch(() => undefined);
  const address = (body as { address?: unknown } | undefined)?.address;

  return typeof address === "string" ? address : undefined;
}
