import type { IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { inject, type InjectionToken, singleton } from "tsyringe";

import { createPublicNetworkLookup, FORBIDDEN_ADDRESS_ERROR_CODE, isPublicAddress } from "@src/template-marketplace/lib/public-network/public-network";
import { DOCKER_HUB_REGISTRY, type ImageReference, parseImageReference } from "@src/template-marketplace/lib/publish-checks/image-reference";

export const IMAGE_REGISTRY_LOOKUP: InjectionToken<LookupFunction> = Symbol("IMAGE_REGISTRY_LOOKUP");

export const IMAGE_DIGEST_UNRESOLVABLE_REASONS = [
  "invalid_reference",
  "unsupported_endpoint",
  "forbidden_address",
  "redirected",
  "unauthorized",
  "not_found",
  "unexpected_status",
  "no_digest",
  "response_too_large"
] as const;

export type ImageDigestUnresolvableReason = (typeof IMAGE_DIGEST_UNRESOLVABLE_REASONS)[number];

/** `unresolvable` will not change by asking again; `unavailable` is a registry or network failure worth a retry. */
export type ImageDigestResolution =
  | { status: "resolved"; digest: string }
  | { status: "unresolvable"; reason: ImageDigestUnresolvableReason }
  | { status: "unavailable"; reason: string };

type RegistryResponse = { status: number; headers: IncomingHttpHeaders; body: string };

type BearerChallenge = { realm: string; service?: string; scope?: string };

const DOCKER_HUB_REGISTRY_HOST = "registry-1.docker.io";
const DEFAULT_TAG = "latest";
const MAX_IMAGE_REFERENCE_LENGTH = 512;

/** One image may take a manifest request, a token request and a second manifest request, all inside this budget. */
export const IMAGE_RESOLUTION_TIMEOUT_MS = 15_000;
const IDLE_SOCKET_TIMEOUT_MS = 5_000;
export const MAX_TOKEN_RESPONSE_BYTES = 64 * 1024;

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json"
].join(", ");

const REGISTRY_HOST = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?(?::\d{1,5})?$/;
const REPOSITORY_SEGMENT = /^[a-z0-9]+(?:[._-]+[a-z0-9]+)*$/;
const TAG = /^\w[\w.-]{0,127}$/;
const DIGEST = /^(?:sha256:[a-f0-9]{64}|sha512:[a-f0-9]{128})$/;
const BEARER_TOKEN = /^[\w.~+/=-]+$/;
const CHALLENGE_PARAMETER = /(\w+)="([^"]*)"/g;

class UnresolvableImageError extends Error {
  constructor(readonly reason: ImageDigestUnresolvableReason) {
    super(reason);
  }
}

class UnavailableRegistryError extends Error {}

/** Reads an image's digest from its registry as an anonymous client: https on the default port only, public addresses only, no redirect followed, no credential sent and no body read beyond a small token response. */
@singleton()
export class ImageRegistryClient {
  readonly #lookup: LookupFunction;

  constructor(@inject(IMAGE_REGISTRY_LOOKUP, { isOptional: true }) lookup?: LookupFunction) {
    this.#lookup = lookup ?? createPublicNetworkLookup();
  }

  async resolveDigest(image: string): Promise<ImageDigestResolution> {
    try {
      return { status: "resolved", digest: await this.#readDigest(image, AbortSignal.timeout(IMAGE_RESOLUTION_TIMEOUT_MS)) };
    } catch (error) {
      return toFailedResolution(error);
    }
  }

  async #readDigest(image: string, signal: AbortSignal): Promise<string> {
    const reference = parseImageReference(image);

    if (image.length > MAX_IMAGE_REFERENCE_LENGTH) throw new UnresolvableImageError("invalid_reference");
    if (reference.digest) return validDigestOf(reference.digest, "invalid_reference");

    const repositoryPath = registryPathOf(reference);
    const manifestUrl = manifestUrlOf(reference, repositoryPath);
    const anonymous = await this.#send("HEAD", manifestUrl, { accept: MANIFEST_ACCEPT }, 0, signal);
    const answer = anonymous.status === 401 ? await this.#askAgainWithAnonymousToken(manifestUrl, anonymous, repositoryPath, signal) : anonymous;

    return digestOf(answer);
  }

  /** The token is one the registry's own realm hands to anyone, and it goes back to the registry that asked for it and nowhere else. */
  async #askAgainWithAnonymousToken(manifestUrl: URL, challenged: RegistryResponse, repositoryPath: string, signal: AbortSignal): Promise<RegistryResponse> {
    const challenge = parseBearerChallenge(challenged.headers["www-authenticate"]);

    if (!challenge) throw new UnresolvableImageError("unauthorized");

    const tokenUrl = parseEndpoint(challenge.realm);
    if (challenge.service) tokenUrl.searchParams.set("service", challenge.service);
    tokenUrl.searchParams.set("scope", challenge.scope ?? `repository:${repositoryPath}:pull`);

    const tokenResponse = await this.#send("GET", tokenUrl, { accept: "application/json" }, MAX_TOKEN_RESPONSE_BYTES, signal);
    assertNotUnavailable(tokenResponse);

    if (tokenResponse.status !== 200) throw new UnresolvableImageError("unauthorized");

    return await this.#send("HEAD", manifestUrl, { accept: MANIFEST_ACCEPT, authorization: `Bearer ${tokenOf(tokenResponse.body)}` }, 0, signal);
  }

  /** A one-off agent opens a fresh connection per request, so the guarded lookup runs for every connection made. */
  #send(method: "HEAD" | "GET", url: URL, headers: Record<string, string>, maxBodyBytes: number, signal: AbortSignal): Promise<RegistryResponse> {
    assertAllowedEndpoint(url);

    return new Promise((resolve, reject) => {
      const request = https.request(url, { method, headers, lookup: this.#lookup, agent: false, timeout: IDLE_SOCKET_TIMEOUT_MS, signal }, response => {
        const chunks: Buffer[] = [];
        let receivedBytes = 0;

        response.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;

          if (receivedBytes > maxBodyBytes) {
            request.destroy(new UnresolvableImageError("response_too_large"));
            return;
          }

          chunks.push(chunk);
        });
        response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
        response.on("error", reject);
      });

      request.on("timeout", () => request.destroy(new UnavailableRegistryError("timeout")));
      request.on("error", reject);
      request.end();
    });
  }
}

function toFailedResolution(error: unknown): ImageDigestResolution {
  if (error instanceof UnresolvableImageError) return { status: "unresolvable", reason: error.reason };

  const { code, name, message } = error as NodeJS.ErrnoException;

  if (code === FORBIDDEN_ADDRESS_ERROR_CODE) return { status: "unresolvable", reason: "forbidden_address" };

  return { status: "unavailable", reason: error instanceof UnavailableRegistryError ? message : code ?? name };
}

function registryPathOf({ registry, repository }: ImageReference): string {
  return registry === DOCKER_HUB_REGISTRY && !repository.includes("/") ? `library/${repository}` : repository;
}

function manifestUrlOf({ registry, tag = DEFAULT_TAG }: ImageReference, repositoryPath: string): URL {
  const host = registry === DOCKER_HUB_REGISTRY ? DOCKER_HUB_REGISTRY_HOST : registry;

  const manifestUrl = `https://${host}/v2/${repositoryPath}/manifests/${tag}`;
  const isWellFormed = REGISTRY_HOST.test(host) && repositoryPath.split("/").every(segment => REPOSITORY_SEGMENT.test(segment)) && TAG.test(tag);

  if (!isWellFormed || !URL.canParse(manifestUrl)) throw new UnresolvableImageError("invalid_reference");

  return new URL(manifestUrl);
}

function parseEndpoint(url: string): URL {
  if (!URL.canParse(url)) throw new UnresolvableImageError("unsupported_endpoint");

  return new URL(url);
}

/** A host written as an address never reaches the lookup, so it is checked here; every other host is checked by the lookup when the socket connects. */
function assertAllowedEndpoint(url: URL): void {
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") throw new UnresolvableImageError("unsupported_endpoint");

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(host) !== 0 && !isPublicAddress(host)) throw new UnresolvableImageError("forbidden_address");
}

function parseBearerChallenge(header: string | undefined): BearerChallenge | undefined {
  if (!header || !/^bearer\s/i.test(header)) return undefined;

  const parameters = Object.fromEntries([...header.matchAll(CHALLENGE_PARAMETER)].map(([, name, value]) => [name.toLowerCase(), value]));

  return parameters.realm ? { realm: parameters.realm, service: parameters.service, scope: parameters.scope } : undefined;
}

function tokenOf(body: string): string {
  const { token, access_token: accessToken } = parseJsonObject(body);
  const found = token ?? accessToken;

  if (typeof found !== "string" || !BEARER_TOKEN.test(found)) throw new UnresolvableImageError("unauthorized");

  return found;
}

function parseJsonObject(body: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(body);

    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function assertNotUnavailable({ status }: RegistryResponse): void {
  if (status === 408 || status === 429 || status >= 500) throw new UnavailableRegistryError(`status_${status}`);
}

function digestOf(response: RegistryResponse): string {
  assertNotUnavailable(response);

  if (response.status === 200) return validDigestOf(response.headers["docker-content-digest"], "no_digest");
  if (response.status === 401 || response.status === 403) throw new UnresolvableImageError("unauthorized");
  if (response.status === 404) throw new UnresolvableImageError("not_found");

  throw new UnresolvableImageError(response.status >= 300 && response.status < 400 ? "redirected" : "unexpected_status");
}

function validDigestOf(digest: string | string[] | undefined, reasonWhenInvalid: ImageDigestUnresolvableReason): string {
  if (typeof digest !== "string" || !DIGEST.test(digest)) throw new UnresolvableImageError(reasonWhenInvalid);

  return digest;
}
