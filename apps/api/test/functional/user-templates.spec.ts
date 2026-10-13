import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";

describe("User templates", () => {
  const userRepository = container.resolve(UserRepository);
  const userTemplateRepository = container.resolve(UserTemplateRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

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
