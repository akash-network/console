import { isIP } from "node:net";
import tls from "node:tls";

import { assertPublicHost, createForbidPrivateNetworkLookup, type NetworkLookup } from "@src/shared/utils/private-network";

const AKASH_ADDRESS = /^akash1[02-9ac-hj-np-z]{38}$/;

export class ProviderIdentityMismatchError extends Error {
  constructor(
    readonly endpoint: string,
    readonly owner: string,
    readonly presentedOwner: string
  ) {
    super(`Provider endpoint ${endpoint} presents the certificate of ${presentedOwner}, not ${owner}`);
    this.name = "ProviderIdentityMismatchError";
  }
}

/** An endpoint that answers with another owner's certificate reports that owner's cluster, so its status must not be stored as this provider's. */
export async function assertEndpointNotOwnedByAnotherProvider({
  owner,
  endpoint,
  timeoutMs,
  lookup = createForbidPrivateNetworkLookup()
}: {
  owner: string;
  endpoint: string;
  timeoutMs: number;
  lookup?: NetworkLookup;
}): Promise<void> {
  await assertPublicHost(endpoint, lookup);

  const presentedCommonNames = await readCertificateCommonNames(endpoint, timeoutMs, lookup);
  const presentedOwner = presentedCommonNames.find(commonName => commonName !== owner && AKASH_ADDRESS.test(commonName));

  if (presentedOwner) {
    throw new ProviderIdentityMismatchError(endpoint, owner, presentedOwner);
  }
}

function readCertificateCommonNames(endpoint: string, timeoutMs: number, lookup: NetworkLookup): Promise<string[]> {
  const { hostname, port } = new URL(endpoint);
  const host = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;

  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port: Number(port || 443),
      servername: isIP(host) ? undefined : host,
      rejectUnauthorized: false,
      lookup
    });
    const deadline = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timed out reading the certificate of ${endpoint}`));
    }, timeoutMs);

    socket.once("close", () => clearTimeout(deadline));
    socket.once("secureConnect", () => {
      const commonNames = socket.getPeerCertificate().subject?.CN ?? [];
      socket.end();
      resolve([commonNames].flat());
    });
    socket.once("error", reject);
  });
}
