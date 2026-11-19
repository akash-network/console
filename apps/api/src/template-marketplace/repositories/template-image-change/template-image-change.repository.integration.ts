import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TemplateImageChangeRepository } from "./template-image-change.repository";

import { seedTemplate, seedTemplateVersion } from "@test/seeders/db/template.seeder";

const OLD_DIGEST = `sha256:${"a".repeat(64)}`;
const NEW_DIGEST = `sha256:${"b".repeat(64)}`;
const NEWER_DIGEST = `sha256:${"c".repeat(64)}`;

describe(TemplateImageChangeRepository.name, () => {
  describe("recordOpen", () => {
    it("records an open change with both digests and nothing resolved", async () => {
      const { repository, template, version } = await setup();

      const isNew = await repository.recordOpen({ ...changeOf(template.id, version.id), image: "ghcr.io/acme/web:1" });

      expect(isNew).toBe(true);
      expect(await repository.findByTemplateId(template.id)).toEqual([
        {
          id: expect.any(String),
          templateId: template.id,
          templateVersionId: version.id,
          image: "ghcr.io/acme/web:1",
          oldDigest: OLD_DIGEST,
          newDigest: NEW_DIGEST,
          status: "open",
          detectedAt: expect.any(Date),
          resolvedBy: null,
          resolvedAt: null
        }
      ]);
    });

    it("keeps one open change per template and image however often the image is seen moved, and whatever it moved to", async () => {
      const { repository, template, version } = await setup();
      const change = changeOf(template.id, version.id);

      const first = await repository.recordOpen(change);
      const repeats = await Promise.all([
        repository.recordOpen(change),
        repository.recordOpen(change),
        repository.recordOpen({ ...change, newDigest: NEWER_DIGEST })
      ]);

      expect([first, ...repeats]).toEqual([true, false, false, false]);
      expect(await repository.findByTemplateId(template.id)).toMatchObject([{ status: "open", newDigest: NEW_DIGEST }]);
    });

    it("records another image of the same template, and the same image of another template, on their own", async () => {
      const { repository, template, version } = await setup();
      const other = await setup();

      const recorded = [
        await repository.recordOpen({ ...changeOf(template.id, version.id), image: "nginx:1.27" }),
        await repository.recordOpen({ ...changeOf(template.id, version.id), image: "redis:7.4" }),
        await repository.recordOpen({ ...changeOf(other.template.id, other.version.id), image: "nginx:1.27" })
      ];

      expect(recorded).toEqual([true, true, true]);
      expect((await repository.findByTemplateId(template.id)).map(({ image }) => image).sort()).toEqual(["nginx:1.27", "redis:7.4"]);
      expect(await repository.findByTemplateId(other.template.id)).toHaveLength(1);
    });

    it.each(["accepted", "hidden"] as const)("records the image again once staff marked its earlier change %s", async status => {
      const { repository, template, version } = await setup();
      await repository.recordOpen(changeOf(template.id, version.id));
      const changes = resolveTable("TemplateImageChanges");
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .update(changes)
        .set({ status, resolvedBy: "staff@akash.network", resolvedAt: new Date() })
        .where(eq(changes.templateId, template.id));

      const isNew = await repository.recordOpen({ ...changeOf(template.id, version.id), oldDigest: NEW_DIGEST, newDigest: NEWER_DIGEST });

      expect(isNew).toBe(true);
      expect((await repository.findByTemplateId(template.id)).map(change => [change.status, change.newDigest])).toEqual([
        [status, NEW_DIGEST],
        ["open", NEWER_DIGEST]
      ]);
    });

    it("goes with its template when the template is deleted", async () => {
      const { repository, template, version } = await setup();
      await repository.recordOpen(changeOf(template.id, version.id));
      const templates = resolveTable("Templates");

      await container.resolve<ApiPgDatabase>(POSTGRES_DB).delete(templates).where(eq(templates.id, template.id));

      expect(await repository.findByTemplateId(template.id)).toEqual([]);
    });
  });

  function changeOf(templateId: string, templateVersionId: string) {
    return { templateId, templateVersionId, image: "nginx:1.27", oldDigest: OLD_DIGEST, newDigest: NEW_DIGEST };
  }

  async function setup() {
    const template = await seedTemplate({ visibility: "public" });
    const version = await seedTemplateVersion({ templateId: template.id });

    return { repository: container.resolve(TemplateImageChangeRepository), template, version };
  }
});
