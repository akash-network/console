import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { seedOrganization } from "./organization.seeder";

type TemplateInsert = ApiPgTables["Templates"]["$inferInsert"];
type TemplateVersionInsert = ApiPgTables["TemplateVersions"]["$inferInsert"];
type TemplatePublisherInsert = ApiPgTables["TemplatePublishers"]["$inferInsert"];
type TemplateReportInsert = ApiPgTables["TemplateReports"]["$inferInsert"];
type TemplateModerationEventInsert = ApiPgTables["TemplateModerationEvents"]["$inferInsert"];

export const SEEDED_TEMPLATE_SDL = "version: '2.0'";

function db() {
  return container.resolve<ApiPgDatabase>(POSTGRES_DB);
}

/** `isPublic` follows `visibility` unless given, as every write path keeps them. */
export async function seedTemplate(overrides: Partial<TemplateInsert> = {}) {
  const [template] = await db()
    .insert(resolveTable("Templates"))
    .values({
      title: faker.lorem.words(3),
      sdl: SEEDED_TEMPLATE_SDL,
      cpu: 1000,
      ram: 1024,
      storage: 1024,
      isPublic: overrides.visibility === "public",
      ...overrides,
      organizationId: overrides.organizationId ?? (await seedOrganization()).id
    })
    .returning();

  return template;
}

/** Makes the version the template's current one unless told otherwise, as a live version saved through the API is. */
export async function seedTemplateVersion({
  isCurrent = true,
  ...overrides
}: Partial<TemplateVersionInsert> & Pick<TemplateVersionInsert, "templateId"> & { isCurrent?: boolean }) {
  const [version] = await db()
    .insert(resolveTable("TemplateVersions"))
    .values({ version: 1, sdl: SEEDED_TEMPLATE_SDL, ...overrides })
    .returning();

  if (isCurrent) {
    const templates = resolveTable("Templates");
    await db().update(templates).set({ currentVersionId: version.id }).where(eq(templates.id, version.templateId));
  }

  return version;
}

export async function seedTemplatePublisher(overrides: Partial<TemplatePublisherInsert> & Pick<TemplatePublisherInsert, "organizationId">) {
  const [publisher] = await db()
    .insert(resolveTable("TemplatePublishers"))
    .values({ handle: `publisher-${faker.string.alphanumeric(10).toLowerCase()}`, ...overrides })
    .returning();

  return publisher;
}

export async function seedTemplateReport(overrides: Partial<TemplateReportInsert> & Pick<TemplateReportInsert, "templateId" | "templateVersionId">) {
  const [report] = await db()
    .insert(resolveTable("TemplateReports"))
    .values({ reason: "spam", ...overrides })
    .returning();

  return report;
}

export async function seedTemplateModerationEvent(overrides: Partial<TemplateModerationEventInsert> & Pick<TemplateModerationEventInsert, "action">) {
  const [event] = await db()
    .insert(resolveTable("TemplateModerationEvents"))
    .values({ staffEmail: "staff@akash.network", reason: "It mines cryptocurrency.", ...overrides })
    .returning();

  return event;
}

export async function seedTemplateFavorite(templateId: string, userId = `auth0|${faker.string.alphanumeric(24)}`) {
  await db().insert(resolveTable("TemplateFavorites")).values({ userId, templateId, addedDate: new Date() });
}

export async function findStoredTemplate(id: string) {
  const templates = resolveTable("Templates");
  const [template] = await db().select().from(templates).where(eq(templates.id, id));

  return template;
}

export async function findStoredTemplateVersions(templateId: string) {
  const versions = resolveTable("TemplateVersions");

  return await db().select().from(versions).where(eq(versions.templateId, templateId)).orderBy(versions.version);
}
