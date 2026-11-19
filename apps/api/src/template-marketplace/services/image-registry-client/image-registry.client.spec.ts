import nock from "nock";
import type dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPublicNetworkLookup } from "@src/template-marketplace/lib/public-network/public-network";
import { type ImageDigestResolution, ImageRegistryClient, MAX_TOKEN_RESPONSE_BYTES } from "./image-registry.client";

const DIGEST = `sha256:${"ab12".repeat(16)}`;
const DOCKER_HUB = "https://registry-1.docker.io";
const DOCKER_AUTH = "https://auth.docker.io";
const MANIFEST_ACCEPT =
  "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, " +
  "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json";

describe(ImageRegistryClient.name, () => {
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe("a digest the image already names", () => {
    it("answers the digest of an image pinned by one without asking any registry", async () => {
      const { client } = setup();

      expect(await client.resolveDigest(`ghcr.io/acme/web:1@${DIGEST}`)).toEqual({ status: "resolved", digest: DIGEST });
      expect(await client.resolveDigest(`nginx@sha512:${"c".repeat(128)}`)).toEqual({ status: "resolved", digest: `sha512:${"c".repeat(128)}` });
    });

    it.each([
      "nginx@sha256:abc",
      `nginx@md5:${"a".repeat(32)}`,
      `nginx@sha256:${"A".repeat(64)}`,
      `nginx@sha256:${"a".repeat(65)}`,
      "user:secret@ghcr.io/acme/web:1"
    ])("refuses %s, whose digest is not one", async image => {
      const { client } = setup();

      expect(await client.resolveDigest(image)).toEqual({ status: "unresolvable", reason: "invalid_reference" });
    });
  });

  describe("the anonymous token flow", () => {
    it("asks Docker Hub for an official image under library/, takes the anonymous token its realm hands out and reads the digest with it", async () => {
      const { client } = setup();
      const challenged = nock(DOCKER_HUB, { badheaders: ["authorization", "cookie"] })
        .head("/v2/library/nginx/manifests/1.27.2")
        .matchHeader("accept", MANIFEST_ACCEPT)
        .reply(401, "", {
          "www-authenticate": 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/nginx:pull"'
        });
      const token = nock(DOCKER_AUTH, { badheaders: ["authorization", "cookie"] })
        .get("/token")
        .query({ service: "registry.docker.io", scope: "repository:library/nginx:pull" })
        .matchHeader("accept", "application/json")
        .reply(200, { token: "anonymous.token-1_2~3+4/5=" });
      const answered = nock(DOCKER_HUB)
        .head("/v2/library/nginx/manifests/1.27.2")
        .matchHeader("authorization", "Bearer anonymous.token-1_2~3+4/5=")
        .matchHeader("accept", MANIFEST_ACCEPT)
        .reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest("nginx:1.27.2")).toEqual({ status: "resolved", digest: DIGEST });
      expect([challenged.isDone(), token.isDone(), answered.isDone()]).toEqual([true, true, true]);
    });

    it.each([
      { image: "docker.io/library/nginx:1.27", path: "/v2/library/nginx/manifests/1.27" },
      { image: "registry-1.docker.io/library/nginx:1.27", path: "/v2/library/nginx/manifests/1.27" },
      { image: "index.docker.io/acme/web", path: "/v2/acme/web/manifests/latest" },
      { image: "Acme/Web:V2", path: "/v2/acme/web/manifests/V2" },
      { image: "  redis  ", path: "/v2/library/redis/manifests/latest" }
    ])("asks Docker Hub for $image at $path", async ({ image, path }) => {
      const { client } = setup();
      nock(DOCKER_HUB).head(path).reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest(image)).toEqual({ status: "resolved", digest: DIGEST });
    });

    it.each([
      { image: "ghcr.io/acme/web:2", origin: "https://ghcr.io", path: "acme/web", realm: "https://ghcr.io/token", service: "ghcr.io" },
      { image: "quay.io/acme/web:2", origin: "https://quay.io", path: "acme/web", realm: "https://quay.io/v2/auth", service: "quay.io" },
      { image: "gcr.io/acme/web:2", origin: "https://gcr.io", path: "acme/web", realm: "https://gcr.io/v2/token", service: "gcr.io" },
      {
        image: "us-docker.pkg.dev/acme/images/web:2",
        origin: "https://us-docker.pkg.dev",
        path: "acme/images/web",
        realm: "https://us-docker.pkg.dev/v2/token",
        service: "us-docker.pkg.dev"
      },
      { image: "nvcr.io/nvidia/cuda:2", origin: "https://nvcr.io", path: "nvidia/cuda", realm: "https://nvcr.io/proxy_auth", service: "nvcr.io" },
      { image: "registry.example.com/team/web:2", origin: "https://registry.example.com", path: "team/web", realm: "https://auth.example.org/t", service: "r" }
    ])("reads $image from its own registry through the realm that registry names", async ({ image, origin, path, realm, service }) => {
      const { client } = setup();
      const scope = `repository:${path}:pull`;
      const realmUrl = new URL(realm);
      nock(origin)
        .head(`/v2/${path}/manifests/2`)
        .reply(401, "", { "www-authenticate": `Bearer realm="${realm}",service="${service}",scope="${scope}"` });
      nock(realmUrl.origin).get(realmUrl.pathname).query({ service, scope }).reply(200, { access_token: "anonymous" });
      nock(origin).head(`/v2/${path}/manifests/2`).matchHeader("authorization", "Bearer anonymous").reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest(image)).toEqual({ status: "resolved", digest: DIGEST });
      expect(nock.isDone()).toBe(true);
    });

    it("asks for the pull scope of the repository when the challenge names none, and for no service when it names none", async () => {
      const { client } = setup();
      nock("https://ghcr.io").head("/v2/acme/web/manifests/2").reply(401, "", { "www-authenticate": 'bearer realm="https://ghcr.io/token?account=none"' });
      nock("https://ghcr.io").get("/token").query({ account: "none", scope: "repository:acme/web:pull" }).reply(200, { token: "anonymous" });
      nock("https://ghcr.io").head("/v2/acme/web/manifests/2").reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "resolved", digest: DIGEST });
      expect(nock.isDone()).toBe(true);
    });

    it("prefers `token` when the realm answers both names", async () => {
      const { client } = setup();
      challengeFrom("https://ghcr.io", "/v2/acme/web/manifests/2", "https://ghcr.io/token");
      nock("https://ghcr.io").get("/token").query(true).reply(200, { token: "first", access_token: "second" });
      nock("https://ghcr.io").head("/v2/acme/web/manifests/2").matchHeader("authorization", "Bearer first").reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "resolved", digest: DIGEST });
    });

    it.each([
      { name: "refuses to hand out a token", status: 401, body: { errors: [] } },
      { name: "is not found", status: 404, body: {} },
      { name: "answers without a token", status: 200, body: { expires_in: 300 } },
      { name: "answers a token that is not text", status: 200, body: { token: 42 } },
      { name: "answers a token no header may carry", status: 200, body: { token: "two words" } },
      { name: "answers a token with a line break", status: 200, body: { token: "a\r\nx-injected: 1" } },
      { name: "answers an empty token", status: 200, body: { token: "" } },
      { name: "answers something that is not JSON", status: 200, body: "<html>" },
      { name: "answers JSON that is not an object", status: 200, body: "null" },
      { name: "answers a list", status: 200, body: '"token"' }
    ])("gives up as unauthorized when the realm $name", async ({ status, body }) => {
      const { client } = setup();
      challengeFrom("https://ghcr.io", "/v2/acme/web/manifests/2", "https://ghcr.io/token");
      nock("https://ghcr.io").get("/token").query(true).reply(status, body);

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unresolvable", reason: "unauthorized" });
      expect(nock.isDone()).toBe(true);
    });

    it.each([
      { name: "names no scheme it can answer anonymously", header: 'Basic realm="registry"' },
      { name: "names no realm", header: 'Bearer service="ghcr.io"' },
      { name: "only starts like a bearer challenge", header: 'BearerX realm="https://ghcr.io/token"' },
      { name: "is missing", header: undefined }
    ])("gives up as unauthorized when the challenge $name", async ({ header }) => {
      const { client } = setup();
      nock("https://ghcr.io")
        .head("/v2/acme/web/manifests/2")
        .reply(401, "", header ? { "www-authenticate": header } : {});

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unresolvable", reason: "unauthorized" });
    });

    it("stops reading a token response past its size cap", async () => {
      const { client } = setup();
      challengeFrom("https://ghcr.io", "/v2/acme/web/manifests/2", "https://ghcr.io/token");
      nock("https://ghcr.io")
        .get("/token")
        .query(true)
        .reply(200, { token: "t", padding: "x".repeat(MAX_TOKEN_RESPONSE_BYTES) });

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unresolvable", reason: "response_too_large" });
    });

    it("reads a token response that just fits its size cap", async () => {
      const { client } = setup();
      const body = JSON.stringify({ token: "t", padding: "" });
      challengeFrom("https://ghcr.io", "/v2/acme/web/manifests/2", "https://ghcr.io/token");
      nock("https://ghcr.io")
        .get("/token")
        .query(true)
        .reply(200, body.replace('""', `"${"x".repeat(MAX_TOKEN_RESPONSE_BYTES - body.length)}"`));
      nock("https://ghcr.io").head("/v2/acme/web/manifests/2").reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "resolved", digest: DIGEST });
    });
  });

  describe("what the registry answers", () => {
    const ANSWERS: { status: number; headers: Record<string, string>; expected: ImageDigestResolution }[] = [
      { status: 404, headers: {}, expected: { status: "unresolvable", reason: "not_found" } },
      { status: 403, headers: {}, expected: { status: "unresolvable", reason: "unauthorized" } },
      { status: 400, headers: {}, expected: { status: "unresolvable", reason: "unexpected_status" } },
      { status: 299, headers: {}, expected: { status: "unresolvable", reason: "unexpected_status" } },
      { status: 300, headers: {}, expected: { status: "unresolvable", reason: "redirected" } },
      { status: 399, headers: {}, expected: { status: "unresolvable", reason: "redirected" } },
      { status: 200, headers: {}, expected: { status: "unresolvable", reason: "no_digest" } },
      { status: 200, headers: { "docker-content-digest": "sha256:short" }, expected: { status: "unresolvable", reason: "no_digest" } },
      { status: 200, headers: { "docker-content-digest": `prefix-${DIGEST}` }, expected: { status: "unresolvable", reason: "no_digest" } },
      { status: 200, headers: { "docker-content-digest": `${DIGEST}0` }, expected: { status: "unresolvable", reason: "no_digest" } },
      { status: 408, headers: {}, expected: { status: "unavailable", reason: "status_408" } },
      { status: 429, headers: {}, expected: { status: "unavailable", reason: "status_429" } },
      { status: 500, headers: {}, expected: { status: "unavailable", reason: "status_500" } },
      { status: 503, headers: {}, expected: { status: "unavailable", reason: "status_503" } }
    ];

    it.each(ANSWERS)("answers $expected for a $status with $headers", async ({ status, headers, expected }) => {
      const { client } = setup();
      nock("https://ghcr.io").head("/v2/acme/web/manifests/2").reply(status, "", headers);

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual(expected);
    });

    it.each([301, 302, 307, 308])("does not follow a %s redirect, wherever it points", async status => {
      const { client } = setup();
      const redirect = nock("https://ghcr.io").head("/v2/acme/web/manifests/2").reply(status, "", { location: "https://169.254.169.254/latest/meta-data/" });
      const target = nock("https://169.254.169.254").head("/latest/meta-data/").reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unresolvable", reason: "redirected" });
      expect([redirect.isDone(), target.isDone()]).toEqual([true, false]);
    });

    it("gives up as unauthorized when the registry refuses the anonymous token too", async () => {
      const { client } = setup();
      challengeFrom("https://ghcr.io", "/v2/acme/private/manifests/2", "https://ghcr.io/token");
      nock("https://ghcr.io").get("/token").query(true).reply(200, { token: "anonymous" });
      nock("https://ghcr.io").head("/v2/acme/private/manifests/2").reply(401, "", { "www-authenticate": 'Bearer realm="https://ghcr.io/token"' });

      expect(await client.resolveDigest("ghcr.io/acme/private:2")).toEqual({ status: "unresolvable", reason: "unauthorized" });
      expect(nock.isDone()).toBe(true);
    });

    it.each([429, 500, 503])("reports the registry unavailable when its realm answers %s", async status => {
      const { client } = setup();
      challengeFrom("https://ghcr.io", "/v2/acme/web/manifests/2", "https://ghcr.io/token");
      nock("https://ghcr.io").get("/token").query(true).reply(status, {});

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unavailable", reason: `status_${status}` });
    });

    it("reports the registry unavailable, with the transport error code, when the connection fails", async () => {
      const { client } = setup();
      nock("https://ghcr.io")
        .head("/v2/acme/web/manifests/2")
        .replyWithError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unavailable", reason: "ECONNRESET" });
    });

    it("reports the registry unavailable, with the error name, when the failure carries no code", async () => {
      const { client } = setup();
      nock("https://ghcr.io").head("/v2/acme/web/manifests/2").replyWithError(new TypeError("unexpected"));

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unavailable", reason: "TypeError" });
    });
  });

  describe("what it refuses to reach", () => {
    it.each([
      { image: "10.0.0.5/acme/web:1", reason: "forbidden_address" },
      { image: "127.0.0.1/acme/web:1", reason: "forbidden_address" },
      { image: "169.254.169.254/latest/meta-data:1", reason: "forbidden_address" },
      { image: "192.168.1.10/acme/web:1", reason: "forbidden_address" },
      { image: "100.64.0.1/acme/web:1", reason: "forbidden_address" },
      { image: "0x7f.1/acme/web:1", reason: "forbidden_address" },
      { image: "127.1/acme/web:1", reason: "forbidden_address" },
      { image: "registry.example.com:5000/acme/web:1", reason: "unsupported_endpoint" },
      { image: "localhost:5000/web:1", reason: "unsupported_endpoint" },
      { image: "[::1]/acme/web:1", reason: "invalid_reference" },
      { image: "[::ffff:127.0.0.1]:443/acme/web:1", reason: "invalid_reference" },
      { image: "-bad.example.com/acme/web:1", reason: "invalid_reference" },
      { image: "bad_host.example.com/acme/web:1", reason: "invalid_reference" },
      { image: "ghcr.io/acme/../web:1", reason: "invalid_reference" },
      { image: "ghcr.io/acme//web:1", reason: "invalid_reference" },
      { image: "ghcr.io/acme/web?x=1:1", reason: "invalid_reference" },
      { image: "ghcr.io/acme/web#frag:1", reason: "invalid_reference" },
      { image: "ghcr.io/acme/-web:1", reason: "invalid_reference" },
      { image: "ghcr.io/acme/web:bad tag", reason: "invalid_reference" },
      { image: "ghcr.io/acme/web:-tag", reason: "invalid_reference" },
      { image: `ghcr.io/acme/web:${"t".repeat(129)}`, reason: "invalid_reference" },
      { image: `ghcr.io/${"a".repeat(520)}:1`, reason: "invalid_reference" },
      { image: "", reason: "invalid_reference" }
    ])("refuses $image as $reason without sending anything", async ({ image, reason }) => {
      const { client, baseLookup } = setup();

      expect(await client.resolveDigest(image)).toEqual({ status: "unresolvable", reason });
      expect(baseLookup).not.toHaveBeenCalled();
    });

    it("reaches a registry that spells out the default https port", async () => {
      const { client } = setup();
      nock("https://registry.example.com").head("/v2/acme/web/manifests/1").reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest("registry.example.com:443/acme/web:1")).toEqual({ status: "resolved", digest: DIGEST });
    });

    it("accepts the longest tag and reference a registry allows", async () => {
      const { client } = setup();
      const tag = "t".repeat(128);
      nock("https://ghcr.io").head(`/v2/acme/web/manifests/${tag}`).reply(200, "", { "docker-content-digest": DIGEST });

      expect(await client.resolveDigest(`ghcr.io/acme/web:${tag}`)).toEqual({ status: "resolved", digest: DIGEST });
    });

    it.each([
      { name: "a plain http realm", realm: "http://ghcr.io/token", reason: "unsupported_endpoint" },
      { name: "a realm on another port", realm: "https://ghcr.io:8443/token", reason: "unsupported_endpoint" },
      { name: "a realm carrying a user name", realm: "https://user@ghcr.io/token", reason: "unsupported_endpoint" },
      { name: "a realm carrying a password", realm: "https://:secret@ghcr.io/token", reason: "unsupported_endpoint" },
      { name: "a realm that is no URL", realm: "not a url", reason: "unsupported_endpoint" },
      { name: "a realm of another scheme", realm: "file:///etc/passwd", reason: "unsupported_endpoint" },
      { name: "the cloud metadata address as realm", realm: "https://169.254.169.254/latest/meta-data/", reason: "forbidden_address" },
      { name: "a loopback realm", realm: "https://127.0.0.1/token", reason: "forbidden_address" },
      { name: "a private realm", realm: "https://10.1.2.3/token", reason: "forbidden_address" },
      { name: "an IPv6 loopback realm", realm: "https://[::1]/token", reason: "forbidden_address" },
      { name: "an IPv4-mapped loopback realm", realm: "https://[::ffff:127.0.0.1]/token", reason: "forbidden_address" },
      { name: "a unique-local realm", realm: "https://[fd00:ec2::254]/token", reason: "forbidden_address" },
      { name: "a realm written as a number", realm: "https://2130706433/token", reason: "forbidden_address" }
    ])("refuses $name as $reason and asks it for nothing", async ({ realm, reason }) => {
      const { client, baseLookup } = setup();
      challengeFrom("https://ghcr.io", "/v2/acme/web/manifests/2", realm);

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unresolvable", reason });
      expect(baseLookup).not.toHaveBeenCalled();
    });

    it.each(["127.0.0.1", "10.0.0.7", "169.254.169.254", "::1", "fd00::1", "::ffff:192.168.0.1"])(
      "refuses a registry whose name resolves to %s when the socket connects",
      async address => {
        const { client, baseLookup } = setup({ resolvesTo: address, reachable: "rebind.example.test" });

        expect(await client.resolveDigest("rebind.example.test/acme/web:1")).toEqual({ status: "unresolvable", reason: "forbidden_address" });
        expect(baseLookup).toHaveBeenCalledWith("rebind.example.test", expect.objectContaining({ all: true }), expect.any(Function));
      }
    );

    it("refuses a realm whose name resolves to a private address when the socket connects", async () => {
      const { client, baseLookup } = setup({ resolvesTo: "10.0.0.7", reachable: "internal-auth.example.test" });
      challengeFrom("https://ghcr.io", "/v2/acme/web/manifests/2", "https://internal-auth.example.test/token");

      expect(await client.resolveDigest("ghcr.io/acme/web:2")).toEqual({ status: "unresolvable", reason: "forbidden_address" });
      expect(baseLookup).toHaveBeenCalledWith("internal-auth.example.test", expect.objectContaining({ all: true }), expect.any(Function));
    });

    it("refuses localhost when the socket connects", async () => {
      const { client } = setup({ resolvesTo: "127.0.0.1", reachable: "localhost" });

      expect(await client.resolveDigest("localhost/web:3")).toEqual({ status: "unresolvable", reason: "forbidden_address" });
    });
  });

  function challengeFrom(origin: string, path: string, realm: string) {
    return nock(origin)
      .head(path)
      .reply(401, "", { "www-authenticate": `Bearer realm="${realm}",service="registry"` });
  }

  function setup(input: { resolvesTo?: string; reachable?: string } = {}) {
    nock.disableNetConnect();
    if (input.reachable) nock.enableNetConnect(input.reachable);

    const address = input.resolvesTo ?? "127.0.0.1";
    const baseLookup = vi.fn(
      (_hostname: string, _options: dns.LookupAllOptions, callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) =>
        callback(null, [{ address, family: address.includes(":") ? 6 : 4 }])
    );
    const client = new ImageRegistryClient(createPublicNetworkLookup(baseLookup));

    return { client, baseLookup };
  }
});
