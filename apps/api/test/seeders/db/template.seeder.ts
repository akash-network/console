import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { scoreTemplate, type ScoringSettings } from "@src/template-marketplace/lib/template-scores/template-scores";
import { seedOrganization } from "./organization.seeder";
import { seedUser } from "./user-with-wallet.seeder";

type TemplateInsert = ApiPgTables["Templates"]["$inferInsert"];
type TemplateVersionInsert = ApiPgTables["TemplateVersions"]["$inferInsert"];
type TemplatePublisherInsert = ApiPgTables["TemplatePublishers"]["$inferInsert"];
type TemplateReportInsert = ApiPgTables["TemplateReports"]["$inferInsert"];
type TemplateModerationEventInsert = ApiPgTables["TemplateModerationEvents"]["$inferInsert"];
type TemplateImageChangeInsert = ApiPgTables["TemplateImageChanges"]["$inferInsert"];
type TemplateUsageEventInsert = ApiPgTables["TemplateUsageEvents"]["$inferInsert"];

export const SEEDED_TEMPLATE_SDL = "version: '2.0'";

export const SEEDED_SCORING_SETTINGS: ScoringSettings = {
  trialWeight: 0.25,
  popularHalfLifeDays: 30,
  popularWindowDays: 180,
  trendingWindowDays: 7,
  trendingMinVolume: 5
};

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

/** Each deploy is by another user, on mainnet, from outside every organization unless told otherwise, which is what makes a template popular. */
export async function seedTemplateDeployers(templateId: string, count: number, overrides: Partial<TemplateUsageEventInsert> = {}) {
  if (count === 0) return;

  const users = await Promise.all(Array.from({ length: count }, () => seedUser()));

  await db()
    .insert(resolveTable("TemplateUsageEvents"))
    .values(
      users.map(user => ({
        source: "console" as const,
        templateRef: templateId,
        action: "deploy" as const,
        userId: user.id,
        deploymentSettingId: faker.string.uuid(),
        network: "mainnet",
        ...overrides
      }))
    );
}

/** One mainnet event of a Console template by a new user from outside every organization, unless told otherwise. */
export async function seedTemplateUsageEvent(overrides: Partial<TemplateUsageEventInsert> & Pick<TemplateUsageEventInsert, "templateRef" | "action">) {
  const [event] = await db()
    .insert(resolveTable("TemplateUsageEvents"))
    .values({
      source: "console",
      deploymentSettingId: faker.string.uuid(),
      network: "mainnet",
      ...overrides,
      userId: "userId" in overrides ? overrides.userId : (await seedUser()).id
    })
    .returning();

  return event;
}

type TemplateScoreInsert = ApiPgTables["TemplateScores"]["$inferInsert"];

export async function seedTemplateScore(overrides: Partial<TemplateScoreInsert> & Pick<TemplateScoreInsert, "templateRef">) {
  const [score] = await db()
    .insert(resolveTable("TemplateScores"))
    .values({ source: "console", breakdown: scoreTemplate([], 0, SEEDED_SCORING_SETTINGS).breakdown, ...overrides })
    .returning();

  return score;
}

export async function findStoredTemplateScores() {
  const scores = resolveTable("TemplateScores");

  return await db().select().from(scores).orderBy(scores.source, scores.templateRef);
}

export async function seedTemplateImageChange(
  overrides: Partial<TemplateImageChangeInsert> & Pick<TemplateImageChangeInsert, "templateId" | "templateVersionId">
) {
  const [change] = await db()
    .insert(resolveTable("TemplateImageChanges"))
    .values({ image: "nginx:1.27", oldDigest: `sha256:${"a".repeat(64)}`, newDigest: `sha256:${"b".repeat(64)}`, ...overrides })
    .returning();

  return change;
}

export async function findStoredTemplateImageChanges(templateId: string) {
  const changes = resolveTable("TemplateImageChanges");

  return await db().select().from(changes).where(eq(changes.templateId, templateId)).orderBy(changes.detectedAt, changes.image);
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
