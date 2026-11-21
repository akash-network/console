import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { MAX_RESOLVED_IMAGES_PER_VERSION, ResolveTemplateVersionImageDigestsHandler } from "./resolve-template-version-image-digests.handler";
import { ResolveTemplateVersionImageDigests, resolveTemplateVersionImageDigestsKeyFor } from "./resolve-template-version-image-digests.job";

import {
  findStoredTemplateImageChanges,
  findStoredTemplateVersions,
  seedTemplate,
  seedTemplateImageChange,
  seedTemplatePublisher,
  seedTemplateVersion
} from "@test/seeders/db/template.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const JOB = ResolveTemplateVersionImageDigests[JOB_NAME];
const WEB_IMAGE = "ghcr.io/acme/web:1.2";
const DB_IMAGE = "postgres:16.4";
const WEB_DIGEST = `sha256:${"a".repeat(64)}`;
const DB_DIGEST = `sha256:${"b".repeat(64)}`;
const MOVED_DIGEST = `sha256:${"c".repeat(64)}`;
const PINNED_DIGEST = `sha256:${"d".repeat(64)}`;
const PINNED_IMAGE = `quay.io/acme/worker@${PINNED_DIGEST}`;
const FIRST_ATTEMPT = { id: "job", retryCount: 0, retryLimit: 5 };
const LAST_ATTEMPT = { id: "job", retryCount: 5, retryLimit: 5 };

const jobWorkers = useJobWorkers(() => [container.resolve(ResolveTemplateVersionImageDigestsHandler)]);

describe(ResolveTemplateVersionImageDigestsHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("records the digest of every image of a saved version, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await setup();
    const template = await seedTemplate({ visibility: "private" });
    const version = await seedTemplateVersion({
      templateId: template.id,
      sdl: sdlOf({ web: WEB_IMAGE, db: DB_IMAGE, worker: PINNED_IMAGE, replica: WEB_IMAGE })
    });
    const ghcr = answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", WEB_DIGEST);
    const dockerHub = answerDigestBehindToken("/v2/library/postgres/manifests/16.4", DB_DIGEST);

    await enqueue(new ResolveTemplateVersionImageDigests({ versionId: version.id }), { singletonKey: resolveTemplateVersionImageDigestsKeyFor(version.id) });
    await startWorkers();

    await expectJobCompleted(JOB, { singletonKey: resolveTemplateVersionImageDigestsKeyFor(version.id) });
    expect(await storedDigestsOf(template.id)).toEqual({ [WEB_IMAGE]: WEB_DIGEST, [DB_IMAGE]: DB_DIGEST, [PINNED_IMAGE]: PINNED_DIGEST });
    expect([ghcr.isDone(), dockerHub.isDone()]).toEqual([true, true]);
    expect(await findStoredTemplateImageChanges(template.id)).toEqual([]);
  });

  it("leaves an image that cannot be resolved without a digest, records the others and does not ask again", async () => {
    const { handler } = await setup();
    const template = await seedTemplate();
    const version = await seedTemplateVersion({
      templateId: template.id,
      sdl: sdlOf({ web: WEB_IMAGE, gone: "ghcr.io/acme/gone:1", internal: "10.0.0.5/acme/web:1" })
    });
    answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", WEB_DIGEST);
    nock("https://ghcr.io").head("/v2/acme/gone/manifests/1").reply(404);

    await expect(handler.handle({ versionId: version.id, version: 1 }, FIRST_ATTEMPT)).resolves.toBeUndefined();

    expect(await storedDigestsOf(template.id)).toEqual({ [WEB_IMAGE]: WEB_DIGEST });
  });

  it("fails, so the queue asks again, while a registry is down and attempts remain, keeping what it resolved meanwhile", async () => {
    const { handler } = await setup();
    const template = await seedTemplate();
    const version = await seedTemplateVersion({ templateId: template.id, sdl: sdlOf({ web: WEB_IMAGE, db: "quay.io/acme/db:3" }) });
    answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", WEB_DIGEST);
    nock("https://quay.io").head("/v2/acme/db/manifests/3").reply(503);

    await expect(handler.handle({ versionId: version.id, version: 1 }, FIRST_ATTEMPT)).rejects.toThrow(
      `Could not reach the registry of 1 image(s) of template version ${version.id}`
    );

    expect(await storedDigestsOf(template.id)).toEqual({ [WEB_IMAGE]: WEB_DIGEST });
  });

  it("gives up without failing on the last attempt, leaving the unreachable image without a digest", async () => {
    const { handler } = await setup();
    const template = await seedTemplate();
    const version = await seedTemplateVersion({ templateId: template.id, sdl: sdlOf({ web: WEB_IMAGE, db: "quay.io/acme/db:3" }) });
    answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", WEB_DIGEST);
    nock("https://quay.io").head("/v2/acme/db/manifests/3").reply(503);

    await expect(handler.handle({ versionId: version.id, version: 1 }, LAST_ATTEMPT)).resolves.toBeUndefined();

    expect(await storedDigestsOf(template.id)).toEqual({ [WEB_IMAGE]: WEB_DIGEST });
  });

  it("gives up without failing when it is run outside the queue, which could not ask again", async () => {
    const { handler } = await setup();
    const template = await seedTemplate();
    const version = await seedTemplateVersion({ templateId: template.id, sdl: sdlOf({ db: "quay.io/acme/db:3" }) });
    nock("https://quay.io").head("/v2/acme/db/manifests/3").reply(503);

    await expect(handler.handle({ versionId: version.id, version: 1 })).resolves.toBeUndefined();
  });

  it("files an image change when a digest moved under the tag a public template's current version names, and keeps the digest it recorded", async () => {
    const { handler } = await setup();
    const template = await seedTemplate({ visibility: "public" });
    const version = await seedTemplateVersion({
      templateId: template.id,
      sdl: sdlOf({ web: WEB_IMAGE, db: DB_IMAGE }),
      imageDigests: { [WEB_IMAGE]: WEB_DIGEST, [DB_IMAGE]: DB_DIGEST }
    });
    answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", MOVED_DIGEST).persist();
    answerDigest("https://registry-1.docker.io", "/v2/library/postgres/manifests/16.4", DB_DIGEST).persist();

    await handler.handle({ versionId: version.id, version: 1 }, FIRST_ATTEMPT);
    await handler.handle({ versionId: version.id, version: 1 }, FIRST_ATTEMPT);

    expect(await findStoredTemplateImageChanges(template.id)).toEqual([
      {
        id: expect.any(String),
        templateId: template.id,
        templateVersionId: version.id,
        image: WEB_IMAGE,
        oldDigest: WEB_DIGEST,
        newDigest: MOVED_DIGEST,
        status: "open",
        detectedAt: expect.any(Date),
        resolvedBy: null,
        resolvedAt: null
      }
    ]);
    expect(await storedDigestsOf(template.id)).toEqual({ [WEB_IMAGE]: WEB_DIGEST, [DB_IMAGE]: DB_DIGEST });
  });

  it("files the change again once staff accepted an earlier one and the image moved further", async () => {
    const { handler } = await setup();
    const template = await seedTemplate({ visibility: "public" });
    const version = await seedTemplateVersion({ templateId: template.id, sdl: sdlOf({ web: WEB_IMAGE }), imageDigests: { [WEB_IMAGE]: WEB_DIGEST } });
    await seedTemplateImageChange({ templateId: template.id, templateVersionId: version.id, image: WEB_IMAGE, status: "accepted", newDigest: WEB_DIGEST });
    answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", MOVED_DIGEST);

    await handler.handle({ versionId: version.id, version: 1 }, FIRST_ATTEMPT);

    expect((await findStoredTemplateImageChanges(template.id)).map(change => [change.status, change.oldDigest, change.newDigest])).toEqual(
      expect.arrayContaining([
        ["accepted", expect.any(String), WEB_DIGEST],
        ["open", WEB_DIGEST, MOVED_DIGEST]
      ])
    );
  });

  it.each([
    { name: "private", template: { visibility: "private" as const } },
    { name: "shared with its organization only", template: { visibility: "organization" as const } },
    { name: "hidden", template: { visibility: "public" as const, moderationStatus: "hidden" as const } },
    { name: "removed", template: { visibility: "public" as const, moderationStatus: "removed" as const } }
  ])("files no image change for a template that is $name", async ({ template: overrides }) => {
    const { handler } = await setup();
    const template = await seedTemplate(overrides);
    const version = await seedTemplateVersion({ templateId: template.id, sdl: sdlOf({ web: WEB_IMAGE }), imageDigests: { [WEB_IMAGE]: WEB_DIGEST } });
    answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", MOVED_DIGEST);

    await handler.handle({ versionId: version.id, version: 1 }, FIRST_ATTEMPT);

    expect(await findStoredTemplateImageChanges(template.id)).toEqual([]);
    expect(await storedDigestsOf(template.id)).toEqual({ [WEB_IMAGE]: WEB_DIGEST });
  });

  it("files no image change for a suspended publisher's template or for a version that is not the current one", async () => {
    const { handler } = await setup();
    const suspended = await seedTemplate({ visibility: "public" });
    await seedTemplatePublisher({ organizationId: suspended.organizationId, publishingSuspendedAt: new Date() });
    const ofSuspended = await seedTemplateVersion({ templateId: suspended.id, sdl: sdlOf({ web: WEB_IMAGE }), imageDigests: { [WEB_IMAGE]: WEB_DIGEST } });
    const template = await seedTemplate({ visibility: "public" });
    const earlier = await seedTemplateVersion({ templateId: template.id, sdl: sdlOf({ web: WEB_IMAGE }), imageDigests: { [WEB_IMAGE]: WEB_DIGEST } });
    await seedTemplateVersion({ templateId: template.id, version: 2, sdl: sdlOf({ web: "ghcr.io/acme/web:1.3" }) });
    answerDigest("https://ghcr.io", "/v2/acme/web/manifests/1.2", MOVED_DIGEST).persist();

    await handler.handle({ versionId: ofSuspended.id, version: 1 }, FIRST_ATTEMPT);
    await handler.handle({ versionId: earlier.id, version: 1 }, FIRST_ATTEMPT);

    expect(await findStoredTemplateImageChanges(suspended.id)).toEqual([]);
    expect(await findStoredTemplateImageChanges(template.id)).toEqual([]);
  });

  it("asks about no more images than one job can afford, and about each image once", async () => {
    const { handler } = await setup();
    const template = await seedTemplate();
    const images = Array.from({ length: MAX_RESOLVED_IMAGES_PER_VERSION + 2 }, (_, index) => `ghcr.io/acme/svc-${index}:1`);
    const version = await seedTemplateVersion({
      templateId: template.id,
      sdl: sdlOf(Object.fromEntries([...images, images[0]].map((image, index) => [`service-${index}`, image])))
    });
    const asked = nock("https://ghcr.io")
      .head(/^\/v2\/acme\/svc-\d+\/manifests\/1$/)
      .times(images.length + 1)
      .reply(200, "", { "docker-content-digest": WEB_DIGEST });

    await handler.handle({ versionId: version.id, version: 1 }, FIRST_ATTEMPT);

    expect(Object.keys(await storedDigestsOf(template.id))).toEqual(images.slice(0, MAX_RESOLVED_IMAGES_PER_VERSION));
    expect(asked.pendingMocks()).toHaveLength(1);
  });

  it("does nothing for a version that does not exist, or one whose SDL names no image", async () => {
    const { handler } = await setup();
    const template = await seedTemplate();
    const emptied = await seedTemplateVersion({ templateId: template.id, sdl: "" });

    await expect(handler.handle({ versionId: faker.string.uuid(), version: 1 }, FIRST_ATTEMPT)).resolves.toBeUndefined();
    await expect(handler.handle({ versionId: emptied.id, version: 1 }, FIRST_ATTEMPT)).resolves.toBeUndefined();

    expect(await storedDigestsOf(template.id)).toEqual({});
  });

  function answerDigest(origin: string, path: string, digest: string) {
    return nock(origin).head(path).reply(200, "", { "docker-content-digest": digest });
  }

  function answerDigestBehindToken(path: string, digest: string) {
    nock("https://registry-1.docker.io")
      .head(path)
      .reply(401, "", { "www-authenticate": 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io"' });
    nock("https://auth.docker.io").get("/token").query(true).reply(200, { token: "anonymous" });

    return nock("https://registry-1.docker.io").head(path).matchHeader("authorization", "Bearer anonymous").reply(200, "", { "docker-content-digest": digest });
  }

  function sdlOf(images: Record<string, string>) {
    return JSON.stringify({ version: "2.0", services: Object.fromEntries(Object.entries(images).map(([service, image]) => [service, { image }])) });
  }

  async function storedDigestsOf(templateId: string) {
    const [version] = await findStoredTemplateVersions(templateId);

    return version.imageDigests;
  }

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();

    return { handler: container.resolve(ResolveTemplateVersionImageDigestsHandler), enqueue, startWorkers };
  }
});
