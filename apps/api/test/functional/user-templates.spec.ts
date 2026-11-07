import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { app } from "@src/rest-app";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";

describe("User templates", () => {
  const userRepository = container.resolve(UserRepository);
  const userTemplateRepository = container.resolve(UserTemplateRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const templateVersionRepository = container.resolve(TemplateVersionRepository);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /v1/user/saveTemplate", () => {
    it("saves a template whose resource quantities are whole numbers", async () => {
      const { user, token } = await setup();
      const template = buildTemplate({ cpu: 1000, ram: 536870912, storage: 1073741824 });

      const response = await saveTemplate(token, template);

      expect(response.status).toBe(200);
      expect(await userTemplateRepository.findById(await response.text(), user.userId!)).toMatchObject({
        userId: user.userId,
        title: template.title,
        cpu: 1000,
        ram: 536870912,
        storage: 1073741824
      });
    });

    it("saves a public template as public but not listed", async () => {
      const { user, token } = await setup();

      const response = await saveTemplate(token, { ...buildTemplate(), isPublic: true });

      const templateId = await response.text();
      expect(await findStoredTemplate(templateId)).toMatchObject({ visibility: "public", isListed: false, authorId: user.id });
      expect(await templateVersionRepository.listByTemplate(templateId)).toHaveLength(1);
    });

    it("answers a save exactly as before", async () => {
      const { token } = await setup();

      const response = await saveTemplate(token, buildTemplate());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("versions an update that changes the sdl and leaves one that keeps it", async () => {
      const { token } = await setup();
      const template = buildTemplate();
      const id = await (await saveTemplate(token, template)).text();

      await saveTemplate(token, { ...template, id, title: faker.lorem.words(3) });
      expect(await templateVersionRepository.listByTemplate(id)).toHaveLength(1);

      await saveTemplate(token, { ...template, id, sdl: "version: '2.1'" });
      const versions = await templateVersionRepository.listByTemplate(id);

      expect(versions.map(({ version }) => version)).toEqual([2, 1]);
      expect(await templateVersionRepository.findCurrent(id)).toMatchObject({ version: 2, sdl: "version: '2.1'" });
    });

    it("keeps visibility in step with isPublic on an update", async () => {
      const { token } = await setup();
      const template = buildTemplate();
      const id = await (await saveTemplate(token, template)).text();

      await saveTemplate(token, { ...template, id, isPublic: true });
      expect(await findStoredTemplate(id)).toMatchObject({ visibility: "public", isListed: false });

      await saveTemplate(token, { ...template, id, isPublic: false });
      expect(await findStoredTemplate(id)).toMatchObject({ visibility: "private", isListed: true });
    });

    it.each([
      { field: "cpu", value: 0.1 },
      { field: "ram", value: -1 },
      { field: "storage", value: Number.MAX_SAFE_INTEGER + 1 }
    ])("answers 400 without saving for a $field of $value", async ({ field, value }) => {
      const { user, token } = await setup();

      const response = await saveTemplate(token, { ...buildTemplate(), [field]: value });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "BadRequestError", code: "validation_error" });
      expect(await userTemplateRepository.findAllByUserId(user.userId!)).toEqual([]);
    });

    it("answers 400 without saving for a title longer than 255 characters", async () => {
      const { user, token } = await setup();

      const response = await saveTemplate(token, buildTemplate({ title: "a".repeat(256) }));

      expect(response.status).toBe(400);
      expect(await userTemplateRepository.findAllByUserId(user.userId!)).toEqual([]);
    });
  });

  function buildTemplate(overrides: Partial<{ title: string; cpu: number; ram: number; storage: number }> = {}) {
    return {
      sdl: "version: '2.0'",
      title: faker.lorem.words(3),
      cpu: 500,
      ram: 268435456,
      storage: 536870912,
      isPublic: false,
      ...overrides
    };
  }

  async function findStoredTemplate(id: string) {
    const templates = resolveTable("Templates");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.id, id));

    return row;
  }

  async function saveTemplate(token: string, template: Record<string, unknown>) {
    return await app.request("/v1/user/saveTemplate", {
      method: "POST",
      body: JSON.stringify(template),
      headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
    });
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async received => (received.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token };
  }
});
