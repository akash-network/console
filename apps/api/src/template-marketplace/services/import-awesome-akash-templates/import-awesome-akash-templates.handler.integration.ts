import { faker } from "@faker-js/faker";
import { eq, isNotNull } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";

import { type ApiPgDatabase, JOB_NAME, JobQueueService, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { TEMPLATE_GALLERY_SERVICE } from "@src/template/providers/template-gallery.provider";
import type { Template } from "@src/template/types/template";
import { hashImportedContent } from "@src/template-marketplace/lib/imported-template/imported-template";
import { TEMPLATE_MARKETPLACE_CONFIG } from "@src/template-marketplace/providers/config.provider";
import { CommunityTemplateRepository } from "@src/template-marketplace/repositories/community-template/community-template.repository";
import { AwesomeAkashImportService } from "@src/template-marketplace/services/awesome-akash-import/awesome-akash-import.service";
import { ResolveTemplateVersionImageDigestsHandler } from "@src/template-marketplace/services/resolve-template-version-image-digests/resolve-template-version-image-digests.handler";
import {
  ResolveTemplateVersionImageDigests,
  resolveTemplateVersionImageDigestsKeyFor
} from "@src/template-marketplace/services/resolve-template-version-image-digests/resolve-template-version-image-digests.job";
import { ImportAwesomeAkashTemplatesHandler } from "./import-awesome-akash-templates.handler";
import { ImportAwesomeAkashTemplates, importAwesomeAkashTemplatesKeyFor, nextTemplateImportWindowAt } from "./import-awesome-akash-templates.job";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { findStoredTemplate, findStoredTemplateVersions, seedTemplateModerationEvent } from "@test/seeders/db/template.seeder";
import { deleteCompletedJobs, deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const IMPORT_JOB = ImportAwesomeAkashTemplates[JOB_NAME];
const DIGEST_JOB = ResolveTemplateVersionImageDigests[JOB_NAME];
const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;

type ServedTemplate = { template: Template; categories: string[] };

const jobWorkers = useJobWorkers(() => [container.resolve(ImportAwesomeAkashTemplatesHandler), container.resolve(ResolveTemplateVersionImageDigestsHandler)]);

describe(ImportAwesomeAkashTemplatesHandler.name, () => {
  it("imports every gallery template once as a public, listed, Official template of the organization, with a first live version, and queues its own next run", async () => {
    const { organization, serveGallery, runImport, intervalSeconds } = await setup();
    const comfyui = createGalleryTemplate({ name: "ComfyUI", summary: "A node based interface for Stable Diffusion", readme: "# ComfyUI\n\nRuns on a GPU." });
    const ollama = createGalleryTemplate({ name: "Ollama" });
    serveGallery([
      { template: comfyui, categories: ["AI - GPU", "Tools"] },
      { template: ollama, categories: ["AI - CPU"] }
    ]);
    const startedAt = Date.now();

    await runImport();

    const [imported, other] = await Promise.all([findImported(comfyui.id), findImported(ollama.id)]);
    expect(imported).toMatchObject({
      organizationId: organization.id,
      importedRef: comfyui.id,
      importedContentHash: hashImportedContent({ sdl: comfyui.deploy, readme: comfyui.readme, githubUrl: comfyui.githubUrl }),
      title: "ComfyUI",
      summary: "A node based interface for Stable Diffusion",
      icon: "box",
      categories: ["AI - GPU", "Tools"],
      visibility: "public",
      isPublic: true,
      isListed: true,
      isOfficial: true,
      moderationStatus: "active",
      userId: null,
      authorId: null,
      projectId: null,
      sdl: comfyui.deploy,
      description: comfyui.readme,
      cpu: 500,
      ram: 512 * MEBIBYTE,
      storage: GIBIBYTE
    });
    expect(imported.publishedAt!.getTime()).toBeGreaterThanOrEqual(startedAt - 5_000);
    const versions = await findStoredTemplateVersions(imported.id);
    expect(versions).toMatchObject([
      {
        id: imported.currentVersionId,
        version: 1,
        status: "live",
        sdl: comfyui.deploy,
        readme: comfyui.readme,
        askedValues: [],
        resources: { cpu: 0.5, memoryBytes: 512 * MEBIBYTE, storageBytes: GIBIBYTE },
        checkResults: null,
        holdReasons: null,
        createdById: null
      }
    ]);
    expect(await findJobRows(DIGEST_JOB, { singletonKey: resolveTemplateVersionImageDigestsKeyFor(versions[0].id) })).toHaveLength(1);
    expect(other).toMatchObject({ title: "Ollama", categories: ["AI - CPU"], isOfficial: true });
    const publisher = await findPublisher(organization.id);
    expect(publisher).toMatchObject({ handle: organization.slug, isVerified: false, publishingSuspendedAt: null });
    const cards = await container.resolve(CommunityTemplateRepository).list({ organizationId: organization.id, limit: 10 });
    expect(
      cards.map(card => ({ id: card.id, importedRef: card.importedRef, isOfficial: card.isOfficial, versionCount: card.versionCount })).sort(byId)
    ).toEqual(
      [
        { id: imported.id, importedRef: comfyui.id, isOfficial: true, versionCount: 1 },
        { id: other.id, importedRef: ollama.id, isOfficial: true, versionCount: 1 }
      ].sort(byId)
    );
    const nextWindow = nextTemplateImportWindowAt(new Date(), intervalSeconds);
    expect(await findJobRows(IMPORT_JOB, { state: "created" })).toMatchObject([
      { singleton_key: importAwesomeAkashTemplatesKeyFor(nextWindow), data: { windowStartsAt: nextWindow.toISOString(), version: 1 } }
    ]);
  });

  it("writes nothing when it runs again over an unchanged gallery, even built from another commit", async () => {
    const { serveGallery, runImport } = await setup();
    const linked = createGalleryTemplate({ readme: readmeLinkedAt("1".repeat(40)), githubUrl: galleryUrlAt("1".repeat(40)) });
    const plain = createGalleryTemplate();
    serveGallery([served(linked), served(plain)]);
    await runImport();
    const before = await Promise.all([findImported(linked.id), findImported(plain.id)]);

    serveGallery([served({ ...linked, readme: readmeLinkedAt("2".repeat(40)), githubUrl: galleryUrlAt("2".repeat(40)) }), served(plain)]);
    await runImport();

    const after = await Promise.all([findImported(linked.id), findImported(plain.id)]);
    expect(after).toEqual(before);
    expect(await Promise.all(after.map(async template => (await findStoredTemplateVersions(template.id)).length))).toEqual([1, 1]);
    expect(await findJobRows(DIGEST_JOB, { singletonKeyLike: "%" })).toHaveLength(2);
  });

  it("saves a new live version and moves the current one when the SDL or the readme changed, keeping the earlier versions", async () => {
    const { serveGallery, runImport } = await setup();
    const resized = createGalleryTemplate();
    const rewritten = createGalleryTemplate({ readme: "# Before" });
    serveGallery([served(resized), served(rewritten)]);
    await runImport();
    const firstVersionId = (await findImported(resized.id)).currentVersionId;
    const biggerSdl = buildSdl({ image: "nginx:1.27.1", cpu: 2 });

    serveGallery([served({ ...resized, deploy: biggerSdl }), served({ ...rewritten, readme: "# After" })]);
    await runImport();

    const template = await findImported(resized.id);
    const versions = await findStoredTemplateVersions(template.id);
    expect(versions).toMatchObject([
      { id: firstVersionId, version: 1, status: "live", sdl: resized.deploy },
      { id: template.currentVersionId, version: 2, status: "live", sdl: biggerSdl, resources: { cpu: 2 }, changes: ["image_tag_changed", "resources_changed"] }
    ]);
    expect(template).toMatchObject({
      sdl: biggerSdl,
      cpu: 2000,
      importedContentHash: hashImportedContent({ sdl: biggerSdl, readme: resized.readme, githubUrl: resized.githubUrl }),
      isListed: true
    });
    expect(await findJobRows(DIGEST_JOB, { singletonKey: resolveTemplateVersionImageDigestsKeyFor(versions[1].id) })).toHaveLength(1);
    const other = await findImported(rewritten.id);
    expect(await findStoredTemplateVersions(other.id)).toMatchObject([
      { version: 1, readme: "# Before" },
      { id: other.currentVersionId, version: 2, status: "live", readme: "# After", sdl: rewritten.deploy, changes: ["readme_changed"] }
    ]);
    expect(other.description).toBe("# After");
  });

  it("renames, re-summarizes and re-files a template in place, with no new version", async () => {
    const { serveGallery, runImport } = await setup();
    const template = createGalleryTemplate({ name: "Before", summary: "Old summary" });
    serveGallery([{ template, categories: ["Tools"] }]);
    await runImport();
    const before = await findImported(template.id);

    serveGallery([{ template: { ...template, name: "After", summary: "New summary" }, categories: ["Hosting", "Tools"] }]);
    await runImport();

    const after = await findImported(template.id);
    expect(after).toMatchObject({ id: before.id, title: "After", summary: "New summary", categories: ["Hosting", "Tools"] });
    expect(after.currentVersionId).toBe(before.currentVersionId);
    expect(await findStoredTemplateVersions(after.id)).toHaveLength(1);
  });

  it("unlists a template that left the gallery without deleting it, and lists it again when it returns", async () => {
    const { organization, serveGallery, runImport } = await setup();
    const [leaving, staying] = [createGalleryTemplate(), createGalleryTemplate()];
    serveGallery([served(leaving), served(staying)]);
    await runImport();
    const imported = await findImported(leaving.id);

    serveGallery([served(staying)]);
    await runImport();

    expect(await findStoredTemplate(imported.id)).toMatchObject({
      isListed: false,
      visibility: "public",
      moderationStatus: "active",
      isOfficial: true,
      removedAt: null,
      currentVersionId: imported.currentVersionId,
      sdl: leaving.deploy
    });
    expect(await listedRefsOf(organization.id)).toEqual([staying.id]);

    serveGallery([served(staying), served(leaving)]);
    await runImport();

    expect(await findStoredTemplate(imported.id)).toMatchObject({ isListed: true, currentVersionId: imported.currentVersionId });
    expect(await findStoredTemplateVersions(imported.id)).toHaveLength(1);
    expect((await listedRefsOf(organization.id)).sort()).toEqual([leaving.id, staying.id].sort());
  });

  it("leaves a template staff hid or removed exactly as staff left it, whatever the gallery says", async () => {
    const { serveGallery, runImport } = await setup();
    const [hiddenByStaff, removedByStaff, gone] = [
      createGalleryTemplate({ name: "Hidden" }),
      createGalleryTemplate({ name: "Removed" }),
      createGalleryTemplate()
    ];
    serveGallery([served(hiddenByStaff), served(removedByStaff), served(gone)]);
    await runImport();
    const [hidden, removed, goneAndHidden] = await Promise.all([findImported(hiddenByStaff.id), findImported(removedByStaff.id), findImported(gone.id)]);
    await Promise.all([
      moderate(hidden.id, { moderationStatus: "hidden" }),
      moderate(removed.id, { moderationStatus: "removed", visibility: "private", isPublic: false, isListed: false, isOfficial: false, sdl: "" }),
      moderate(goneAndHidden.id, { moderationStatus: "hidden" })
    ]);
    const before = await Promise.all([hidden, removed, goneAndHidden].map(template => findStoredTemplate(template.id)));

    serveGallery([
      served({ ...hiddenByStaff, name: "Renamed", deploy: buildSdl({ image: "nginx:1.27.1" }) }),
      served({ ...removedByStaff, name: "Renamed", deploy: buildSdl({ image: "nginx:1.27.1" }) })
    ]);
    await runImport();

    expect(await Promise.all([hidden, removed, goneAndHidden].map(template => findStoredTemplate(template.id)))).toEqual(before);
    expect(await Promise.all([hidden, removed].map(async template => (await findStoredTemplateVersions(template.id)).length))).toEqual([1, 1]);
    expect(await countImported(removedByStaff.id)).toBe(1);
  });

  it("catches up with the gallery once staff show a hidden template again", async () => {
    const { serveGallery, runImport } = await setup();
    const template = createGalleryTemplate({ name: "Before" });
    serveGallery([served(template)]);
    await runImport();
    const imported = await findImported(template.id);
    await moderate(imported.id, { moderationStatus: "hidden" });
    const changedSdl = buildSdl({ image: "nginx:1.27.1" });
    serveGallery([served({ ...template, name: "After", deploy: changedSdl })]);
    await runImport();

    await moderate(imported.id, { moderationStatus: "active" });
    await runImport();

    expect(await findStoredTemplate(imported.id)).toMatchObject({ title: "After", sdl: changedSdl });
    expect(await findStoredTemplateVersions(imported.id)).toMatchObject([{ version: 1 }, { version: 2, sdl: changedSdl }]);
  });

  it("keeps what staff decided on an active template: its categories, its Official and featured flags, and the version it was rolled back to", async () => {
    const { serveGallery, runImport } = await setup();
    const template = createGalleryTemplate({ name: "Before" });
    serveGallery([{ template, categories: ["Tools"] }]);
    await runImport();
    const secondSdl = buildSdl({ image: "nginx:1.27.1" });
    serveGallery([{ template: { ...template, deploy: secondSdl }, categories: ["Tools"] }]);
    await runImport();
    const imported = await findImported(template.id);
    const [first, second] = await findStoredTemplateVersions(imported.id);
    await moderate(imported.id, { categories: ["Hosting"], isOfficial: false, isFeatured: true, currentVersionId: first.id });
    await seedTemplateModerationEvent({ templateId: imported.id, action: "edit_categories" });

    serveGallery([{ template: { ...template, name: "After", deploy: secondSdl }, categories: ["AI - GPU"] }]);
    await runImport();

    expect(await findStoredTemplate(imported.id)).toMatchObject({
      title: "After",
      categories: ["Hosting"],
      isOfficial: false,
      isFeatured: true,
      currentVersionId: first.id
    });
    expect((await findStoredTemplateVersions(imported.id)).map(version => version.id)).toEqual([first.id, second.id]);

    const thirdSdl = buildSdl({ image: "nginx:1.27.2" });
    serveGallery([{ template: { ...template, name: "After", deploy: thirdSdl }, categories: ["AI - GPU"] }]);
    await runImport();

    const versions = await findStoredTemplateVersions(imported.id);
    expect(versions.map(version => version.version)).toEqual([1, 2, 3]);
    expect(await findStoredTemplate(imported.id)).toMatchObject({ currentVersionId: versions[2].id, categories: ["Hosting"], isOfficial: false });
  });

  it("skips a template whose SDL cannot be read or names an unknown profile, and imports the rest of the gallery", async () => {
    const { organization, serveGallery, runImport } = await setup();
    const unreadable = createGalleryTemplate({ deploy: "services: [" });
    const inconsistent = createGalleryTemplate({ deploy: buildSdl().replace("profile: web", "profile: missing") });
    const sound = createGalleryTemplate();
    serveGallery([served(unreadable), served(sound), served(inconsistent)]);

    await runImport();

    expect(await Promise.all([unreadable, inconsistent, sound].map(template => countImported(template.id)))).toEqual([0, 0, 1]);
    expect(await listedRefsOf(organization.id)).toEqual([sound.id]);
  });

  it("keeps the current version of a template whose new SDL is not valid, and takes the next valid one", async () => {
    const { serveGallery, runImport } = await setup();
    const template = createGalleryTemplate();
    serveGallery([served(template)]);
    await runImport();
    const before = await findImported(template.id);

    serveGallery([served({ ...template, deploy: "services: [" })]);
    await runImport();

    expect(await findStoredTemplate(before.id)).toEqual(before);
    expect(await findStoredTemplateVersions(before.id)).toHaveLength(1);

    const fixedSdl = buildSdl({ image: "nginx:1.27.1" });
    serveGallery([served({ ...template, deploy: fixedSdl })]);
    await runImport();

    expect(await findStoredTemplateVersions(before.id)).toMatchObject([{ version: 1 }, { version: 2, sdl: fixedSdl, status: "live" }]);
  });

  it("creates each template and each version once when two runs overlap", async () => {
    const { organization, serveGallery, runImport } = await setup();
    const templates = Array.from({ length: 6 }, () => createGalleryTemplate());
    serveGallery(templates.map(served));
    const service = container.resolve(AwesomeAkashImportService);

    await Promise.all([service.run(), service.run(), runImport()]);

    expect(await Promise.all(templates.map(template => countImported(template.id)))).toEqual([1, 1, 1, 1, 1, 1]);
    const imported = await Promise.all(templates.map(template => findImported(template.id)));
    expect(await Promise.all(imported.map(async template => (await findStoredTemplateVersions(template.id)).map(version => version.version)))).toEqual(
      templates.map(() => [1])
    );
    expect((await listedRefsOf(organization.id)).sort()).toEqual(templates.map(template => template.id).sort());

    const changed = templates.map(template => ({ ...template, deploy: buildSdl({ image: "nginx:1.27.1" }) }));
    serveGallery(changed.map(served));
    await Promise.all([service.run(), service.run(), runImport()]);

    expect(await Promise.all(imported.map(async template => (await findStoredTemplateVersions(template.id)).map(version => version.version)))).toEqual(
      templates.map(() => [1, 2])
    );
  });

  it.each<[string, { organizationId?: string; isDeleted?: boolean; network?: "sandbox" }]>([
    ["no organization is configured", { organizationId: undefined }],
    ["the configured organization does not exist", { organizationId: faker.string.uuid() }],
    ["the configured organization was deleted", { isDeleted: true }],
    ["the API serves another network than mainnet", { network: "sandbox" }]
  ])("completes without importing anything when %s, and still queues its next run", async (_case, input) => {
    const { organization, serveGallery, runImport } = await setup(input);
    const template = createGalleryTemplate();
    serveGallery([served(template)]);

    await runImport();

    expect(await countImported(template.id)).toBe(0);
    expect(await findPublisher(organization.id)).toBeUndefined();
    expect(await findJobRows(IMPORT_JOB, { state: "created" })).toHaveLength(1);
  });

  it("unlists nothing when the gallery cannot be read or lists no template", async () => {
    const { organization, serveGallery, runImport, breakGallery } = await setup();
    const template = createGalleryTemplate();
    serveGallery([served(template)]);
    await runImport();

    breakGallery();
    await runImport();
    serveGallery([]);
    await runImport();

    expect(await listedRefsOf(organization.id)).toEqual([template.id]);
  });

  it("seeds one run for the next window however many replicas seed it, due when the window starts", async () => {
    const { handler, intervalSeconds } = await setup();
    const now = new Date("2030-01-01T05:10:00.000Z");
    const windowStartsAt = nextTemplateImportWindowAt(now, intervalSeconds);

    await Promise.all([handler.seedNextRun(now), handler.seedNextRun(now)]);
    await handler.seedNextRun(new Date(now.getTime() + 60_000));

    const queued = await findJobRows(IMPORT_JOB, { singletonKey: importAwesomeAkashTemplatesKeyFor(windowStartsAt) });
    expect(queued).toMatchObject([{ state: "created", data: { windowStartsAt: windowStartsAt.toISOString() } }]);
    expect(new Date(queued[0].start_after).toISOString()).toBe(windowStartsAt.toISOString());
  });

  it("keeps the workers starting when seeding fails", async () => {
    const { handler } = await setup();
    const enqueue = vi.spyOn(container.resolve(JobQueueService), "enqueue").mockRejectedValueOnce(new Error("queue is down"));

    await expect(handler.seedNextRun(new Date())).resolves.toBeUndefined();

    expect(enqueue).toHaveBeenCalledTimes(1);
    enqueue.mockRestore();
  });

  function byId(left: { id: string }, right: { id: string }) {
    return left.id.localeCompare(right.id);
  }

  function db() {
    return container.resolve<ApiPgDatabase>(POSTGRES_DB);
  }

  function served(template: Template): ServedTemplate {
    return { template, categories: ["Tools"] };
  }

  function galleryUrlAt(commit: string) {
    return `https://github.com/akash-network/awesome-akash/blob/${commit}/template`;
  }

  function readmeLinkedAt(commit: string) {
    return `# Linked\n\n[guide](https://github.com/akash-network/awesome-akash/blob/${commit}/template/guide.md)`;
  }

  function buildSdl({ image = "nginx:1.27.0", cpu = 0.5 }: { image?: string; cpu?: number } = {}) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      `    image: ${image}`,
      "    expose:",
      "      - port: 80",
      "        as: 80",
      "        to:",
      "          - global: true",
      "profiles:",
      "  compute:",
      "    web:",
      "      resources:",
      "        cpu:",
      `          units: ${cpu}`,
      "        memory:",
      "          size: 512Mi",
      "        storage:",
      "          size: 1Gi",
      "  placement:",
      "    dcloud:",
      "      pricing:",
      "        web:",
      "          denom: uakt",
      "          amount: 1000",
      "deployment:",
      "  web:",
      "    dcloud:",
      "      profile: web",
      "      count: 1"
    ].join("\n");
  }

  function createGalleryTemplate(overrides: Partial<Template> = {}): Template {
    const id = `akash-network-awesome-akash-${faker.string.alphanumeric(16)}`;

    return {
      id,
      name: faker.commerce.productName(),
      path: id,
      readme: `# ${faker.lorem.words(3)}`,
      summary: faker.lorem.sentence().slice(0, 150),
      logoUrl: "",
      deploy: buildSdl(),
      githubUrl: galleryUrlAt(faker.git.commitSha()),
      persistentStorageEnabled: false,
      config: {},
      ...overrides
    };
  }

  async function findImported(importedRef: string) {
    const templates = resolveTable("Templates");
    const [template] = await db().select().from(templates).where(eq(templates.importedRef, importedRef));

    return template;
  }

  async function countImported(importedRef: string) {
    const templates = resolveTable("Templates");

    return (await db().select({ id: templates.id }).from(templates).where(eq(templates.importedRef, importedRef))).length;
  }

  async function findPublisher(organizationId: string) {
    const publishers = resolveTable("TemplatePublishers");
    const [publisher] = await db().select().from(publishers).where(eq(publishers.organizationId, organizationId));

    return publisher;
  }

  async function listedRefsOf(organizationId: string) {
    const cards = await container.resolve(CommunityTemplateRepository).list({ organizationId, limit: 1000 });

    return cards.map(card => card.importedRef);
  }

  async function moderate(templateId: string, change: Partial<ReturnType<typeof resolveTable<"Templates">>["$inferInsert"]>) {
    const templates = resolveTable("Templates");
    await db().update(templates).set(change).where(eq(templates.id, templateId));
  }

  async function setup(input: { organizationId?: string; isDeleted?: boolean; network?: "sandbox" } = {}) {
    const organization = await seedOrganization({ name: "Akash", slug: `akash-${faker.string.alphanumeric(12).toLowerCase()}` });
    if (input.isDeleted) {
      const organizations = resolveTable("Organizations");
      await db().update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, organization.id));
    }
    const config = container.resolve(TEMPLATE_MARKETPLACE_CONFIG);
    config.TEMPLATE_IMPORT_ORGANIZATION_ID = "organizationId" in input ? input.organizationId : organization.id;
    const coreConfig = container.resolve(CoreConfigService);
    const readCoreConfig = CoreConfigService.prototype.get.bind(coreConfig);
    vi.spyOn(coreConfig, "get").mockImplementation(key => (key === "NETWORK" ? input.network ?? "mainnet" : readCoreConfig(key)));
    vi.spyOn(container.resolve(ResolveTemplateVersionImageDigestsHandler), "handle").mockResolvedValue(undefined);
    await db()
      .delete(resolveTable("Templates"))
      .where(isNotNull(resolveTable("Templates").importedRef));
    const gallery = container.resolve(TEMPLATE_GALLERY_SERVICE);
    const summary = vi.spyOn(gallery, "getGallerySummaryBuffer");
    const content = vi.spyOn(gallery, "getTemplateById");
    const { enqueue, startWorkers } = await jobWorkers();
    await Promise.all([deleteQueuedJobs(IMPORT_JOB), deleteCompletedJobs(IMPORT_JOB), deleteQueuedJobs(DIGEST_JOB), deleteCompletedJobs(DIGEST_JOB)]);
    let runs = 0;

    return {
      organization,
      handler: container.resolve(ImportAwesomeAkashTemplatesHandler),
      intervalSeconds: config.TEMPLATE_IMPORT_INTERVAL_SECONDS,
      serveGallery: (templates: ServedTemplate[]) => {
        const titles = [...new Set(templates.flatMap(({ categories }) => categories))];
        const categories = titles.map(title => ({
          title,
          templates: templates.filter(({ categories }) => categories.includes(title)).map(({ template }) => ({ id: template.id, name: template.name }))
        }));
        summary.mockImplementation(async () => Buffer.from(JSON.stringify({ data: categories })));
        content.mockImplementation(async id => templates.find(({ template }) => template.id === id)?.template ?? null);
      },
      breakGallery: () => {
        summary.mockImplementation(async () => {
          throw new Error("ENOENT: no such file or directory");
        });
      },
      runImport: async () => {
        const windowStartsAt = new Date(Date.UTC(2026, 10, 18, runs++));
        await deleteQueuedJobs(IMPORT_JOB);
        await enqueue(new ImportAwesomeAkashTemplates({ windowStartsAt: windowStartsAt.toISOString() }), {
          singletonKey: importAwesomeAkashTemplatesKeyFor(windowStartsAt)
        });
        await startWorkers();
        await expectJobCompleted(IMPORT_JOB, { singletonKey: importAwesomeAkashTemplatesKeyFor(windowStartsAt) });
      }
    };
  }
});
