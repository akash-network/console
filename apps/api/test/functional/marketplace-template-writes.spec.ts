import { faker } from "@faker-js/faker";
import { asc, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;

describe("Marketplace template writes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("answers 404 on every write when template_marketplace is off", async () => {
    const { team, project, owner, actAs } = await setup({ isMarketplaceOn: false });
    const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
    const asOwner = actAs(owner);

    const responses = await Promise.all([
      asOwner("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } }),
      asOwner(`/v1/user-templates/${template.id}/versions`, { method: "POST", body: { data: { sdl: buildSdl(), askedValues: [], baseVersion: 1 } } })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404]);
    expect(await templatesAuthoredBy(owner)).toEqual([expect.objectContaining({ id: template.id })]);
    expect(await versionsOf(template.id)).toHaveLength(1);
  });

  it("answers 401 to a caller without a session", async () => {
    const { read } = await setup();

    const response = await read("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } });

    expect(response.status).toBe(401);
  });

  describe("POST /v1/user-templates", () => {
    it("creates a private template in the caller's filing project with version 1", async () => {
      const { team, project, actAs, addMember } = await setup();
      const member = await addMember("member", "member");
      const sdl = buildSdl();

      const response = await actAs(member)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "  Web server  ", summary: "Serves the web", sdl, readme: "# Web" } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; currentVersion: { id: string } } };
      expect(data).toEqual({
        id: expect.any(String),
        title: "Web server",
        summary: "Serves the web",
        icon: null,
        categories: [],
        visibility: "private",
        isListed: true,
        isOfficial: false,
        moderationStatus: "active",
        copiedFromId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        author: { username: member.username },
        publisher: { name: team.name, slug: team.slug, type: "team" },
        currentVersion: {
          id: expect.any(String),
          templateId: data.id,
          version: 1,
          sdl,
          readme: "# Web",
          askedValues: [],
          resources: { cpu: 1, memoryBytes: 1024 * MEBIBYTE, storageBytes: 2 * GIBIBYTE },
          status: "live",
          changes: ["first_version"],
          createdBy: { username: member.username },
          createdAt: expect.any(String)
        },
        canEdit: true
      });
      expect(await storedTemplate(data.id)).toMatchObject({
        visibility: "private",
        isPublic: false,
        isListed: true,
        authorId: member.id,
        userId: member.userId,
        organizationId: team.id,
        projectId: project.id,
        currentVersionId: data.currentVersion.id,
        title: "Web server",
        summary: "Serves the web",
        sdl,
        description: "# Web",
        cpu: 1000,
        ram: 1024 * MEBIBYTE,
        storage: 2 * GIBIBYTE
      });
    });

    it("files the template in the project the caller names and saves its asked values", async () => {
      const { team, owner, actAs } = await setup();
      const otherProject = await seedProject({ organizationId: team.id });
      const askedValues = [textAskedValue("GREETING")];

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(), askedValues, projectId: otherProject.id } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(await storedTemplate(data.id)).toMatchObject({ projectId: otherProject.id, summary: null, description: null });
      expect(await versionsOf(data.id)).toEqual([expect.objectContaining({ version: 1, askedValues, readme: null })]);
    });

    it("asks for a project when the filing project is ambiguous", async () => {
      const { team, actAs, addMember } = await setup();
      const member = await addMember("member", "member");
      const secondProject = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: secondProject.id, userId: member.id, role: "member" });

      const response = await actAs(member)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "project_required" });
      expect(await templatesAuthoredBy(member)).toEqual([]);
    });

    it.each<[string, Record<string, unknown>]>([
      ["a title of 81 characters", { title: "a".repeat(81) }],
      ["a blank title", { title: "   " }],
      ["a summary of 201 characters", { summary: "a".repeat(201) }],
      ["a readme of 50,001 characters", { readme: "a".repeat(50_001) }],
      ["an SDL over 128 KiB", { sdl: `${buildSdl()}\n#${"a".repeat(128 * 1024)}` }]
    ])("refuses %s", async (_case, fields) => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl(), ...fields } } });

      expect(response.status).toBe(400);
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it.each<[string, { env?: string[]; credentials?: string[] }, ReturnType<typeof secretAskedValue>[], string]>([
      [
        "a plaintext value bound to a secret",
        { env: ["API_KEY=hunter2"] },
        [secretAskedValue("API_KEY")],
        'Variable "API_KEY" is a secret, so web.env.API_KEY must not carry a value'
      ],
      [
        "a secret reference no variable asks for",
        { env: ["API_KEY=ac-secret://API_KEY"] },
        [],
        "web.env.API_KEY references a secret that no variable asks the deployer for"
      ],
      [
        "a plaintext registry password",
        { credentials: ["host: docker.io", "username: me", "password: hunter2"] },
        [],
        'Service "web" carries a registry password; save it as a secret instead'
      ]
    ])("refuses %s, naming the key, service and env", async (_case, sdlParts, askedValues, issue) => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(sdlParts), askedValues } }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_invalid", message: issue, data: { issues: [issue] } });
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it.each<[string, string, RegExp]>([
      ["a map-form env holding a secret-looking value", buildSdl({ envMapping: ["API_KEY: hunter2"] }), /"env" at "\/services\/web" should be array/],
      [
        "an unquoted numeric registry password",
        buildSdl({ credentials: ["host: docker.io", "username: me", "password: 12345"] }),
        /"password" at "\/services\/web\/credentials" should be string/
      ],
      ["an SDL that is not YAML", "services: [web", /^The SDL could not be read: /],
      ["an SDL that is not a mapping", "just text", /^The SDL could not be read$/],
      ["an SDL without services", "version: '2.0'\nservices: {}", /^The SDL defines no services$/],
      ["an SDL with an unknown reference kind", buildSdl({ env: ["API_KEY=ac-vault://API_KEY"] }), /ac-vault/]
    ])("refuses %s before checking its values", async (_case, sdl, issue) => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_invalid", data: { issues: expect.arrayContaining([expect.stringMatching(issue)]) } });
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it("refuses an asked value bound to a service the SDL does not define", async () => {
      const { owner, actAs } = await setup();
      const askedValue = { ...textAskedValue("GREETING"), bindings: [{ service: "api", env: "GREETING" }] };

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(), askedValues: [askedValue] } }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "template_invalid",
        data: { issues: ['Variable "GREETING" fills in service "api", which the SDL does not define'] }
      });
    });

    it("records the template a copy was made from when the caller can read it", async () => {
      const { owner, actAs } = await setup();
      const original = await seedTemplate({ author: null, visibility: "public" });

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Copy", sdl: buildSdl(), copiedFromId: original.id } }
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { copiedFromId: original.id } });
    });

    it("refuses copying from a template the caller cannot read", async () => {
      const { owner, actAs } = await setup();
      const { user: stranger, organization, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const original = await seedTemplate({ author: stranger, organizationId: organization.id, projectId: project.id });

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Copy", sdl: buildSdl(), copiedFromId: original.id } }
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ message: "Template not found" });
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });
  });

  describe("POST /v1/user-templates/{id}/versions", () => {
    it("saves a new version, mirrors the legacy columns and keeps earlier versions unchanged", async () => {
      const { team, project, actAs, addMember } = await setup();
      const editor = await addMember("member", "member");
      const template = await seedTemplate({ author: editor, organizationId: team.id, projectId: project.id });
      const [firstBefore] = await versionsOf(template.id);
      const sdl = buildSdl({ image: "nginx:1.27", count: 3 });

      const response = await actAs(editor)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl, readme: "# Second", askedValues: [textAskedValue("GREETING")], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(data).toEqual({
        id: expect.any(String),
        templateId: template.id,
        version: 2,
        sdl,
        readme: "# Second",
        askedValues: [textAskedValue("GREETING")],
        resources: { cpu: 1.5, memoryBytes: 1536 * MEBIBYTE, storageBytes: 3 * GIBIBYTE },
        status: "live",
        changes: ["image_tag_changed", "asked_value_added", "readme_changed"],
        createdBy: { username: editor.username },
        createdAt: expect.any(String)
      });
      const [firstAfter, second] = await versionsOf(template.id);
      expect(firstAfter).toEqual(firstBefore);
      expect(second.id).toBe(data.id);
      expect(await storedTemplate(template.id)).toMatchObject({
        currentVersionId: data.id,
        sdl,
        description: "# Second",
        cpu: 1500,
        ram: 1536 * MEBIBYTE,
        storage: 3 * GIBIBYTE,
        visibility: "private",
        isPublic: false
      });
    });

    it("carries the readme forward when a new version omits it, and clears it with null", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, readme: "# First" });
      const asOwner = actAs(owner);

      const carried = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 1 }), askedValues: [], baseVersion: 1 } }
      });
      const cleared = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 2 }), readme: null, askedValues: [], baseVersion: 2 } }
      });

      expect([carried.status, cleared.status]).toEqual([201, 201]);
      expect(await carried.json()).toMatchObject({ data: { version: 2, readme: "# First" } });
      expect(await cleared.json()).toMatchObject({ data: { version: 3, readme: null } });
      expect((await versionsOf(template.id)).map(({ readme }) => readme)).toEqual(["# First", "# First", null]);
    });

    it("refuses a new version from a stale base with 409 and saves nothing", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const asOwner = actAs(owner);
      const saved = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } }
      });

      const responses = await Promise.all(
        [1, 5].map(baseVersion =>
          asOwner(`/v1/user-templates/${template.id}/versions`, {
            method: "POST",
            body: { data: { sdl: buildSdl({ count: 4 }), askedValues: [], baseVersion } }
          })
        )
      );

      expect(saved.status).toBe(201);
      expect(responses.map(({ status }) => status)).toEqual([409, 409]);
      expect(await Promise.all(responses.map(response => response.json()))).toEqual([
        expect.objectContaining({ code: "template_version_conflict" }),
        expect.objectContaining({ code: "template_version_conflict" })
      ]);
      expect(await versionsOf(template.id)).toHaveLength(2);
      expect(await storedTemplate(template.id)).toMatchObject({ sdl: buildSdl({ count: 3 }) });
    });

    it("refuses a viewer's new version with 403 and an outsider's with 404", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const viewer = await addMember("member", "viewer");
      const { user: outsider, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const body = { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } };

      const responses = await Promise.all([
        actAs(viewer)(`/v1/user-templates/${template.id}/versions`, { method: "POST", body }),
        actAs(outsider, { organizationId: otherTeam.id })(`/v1/user-templates/${template.id}/versions`, { method: "POST", body }),
        actAs(owner)(`/v1/user-templates/${faker.string.uuid()}/versions`, { method: "POST", body })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 404, 404]);
      expect(await responses[0].json()).toMatchObject({ message: "You cannot change this template" });
      expect(await versionsOf(template.id)).toHaveLength(1);
    });

    it("refuses a new version whose SDL leaks a secret", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ env: ["API_KEY=hunter2"] }), askedValues: [secretAskedValue("API_KEY")], baseVersion: 1 } }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "template_invalid",
        data: { issues: ['Variable "API_KEY" is a secret, so web.env.API_KEY must not carry a value'] }
      });
      expect(await versionsOf(template.id)).toHaveLength(1);
    });

    it("leaves the legacy read of the template coherent", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const asOwner = actAs(owner);
      const sdl = buildSdl({ image: "nginx:1.27" });

      const saved = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl, readme: "# Updated", askedValues: [], baseVersion: 1 } }
      });
      const legacy = await asOwner(`/v1/user/template/${template.id}`);

      expect(saved.status).toBe(201);
      expect(legacy.status).toBe(200);
      expect(await legacy.json()).toMatchObject({ id: template.id, sdl, description: "# Updated", cpu: 1000, ram: 1024 * MEBIBYTE, storage: 2 * GIBIBYTE });
    });
  });

  function buildSdl({
    image = "nginx:1.25",
    env,
    envMapping,
    credentials,
    count = 2
  }: { image?: string; env?: string[]; envMapping?: string[]; credentials?: string[]; count?: number } = {}) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      `    image: ${image}`,
      ...(env ? ["    env:", ...env.map(entry => `      - ${entry}`)] : []),
      ...(envMapping ? ["    env:", ...envMapping.map(entry => `      ${entry}`)] : []),
      ...(credentials ? ["    credentials:", ...credentials.map(entry => `      ${entry}`)] : []),
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
      "          units: 0.5",
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
      `      count: ${count}`
    ].join("\n");
  }

  function textAskedValue(key: string) {
    return { key, label: key, type: "text" as const, required: false, bindings: [{ service: "web", env: key }] };
  }

  function secretAskedValue(key: string) {
    return { key, label: key, type: "secret" as const, required: true, bindings: [{ service: "web", env: key }] };
  }

  async function seedTemplate(input: {
    author: UserOutput | null;
    organizationId?: string;
    projectId?: string;
    visibility?: TemplateVisibility;
    readme?: string;
  }) {
    const { author, readme, visibility = "private", ...template } = input;
    const sdl = buildSdl();
    const [row] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({
        ...template,
        sdl,
        visibility,
        isPublic: visibility === "public",
        userId: author?.userId ?? null,
        authorId: author?.id ?? null,
        title: faker.lorem.words(3),
        description: readme,
        cpu: 1000,
        ram: 1024 * MEBIBYTE,
        storage: 2 * GIBIBYTE
      })
      .returning();
    await container.resolve(TemplateVersionRepository).appendVersion({ templateId: row.id, sdl, readme, createdById: author?.id });

    return row;
  }

  async function storedTemplate(id: string) {
    const templates = resolveTable("Templates");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.id, id));

    return row;
  }

  async function templatesAuthoredBy(user: UserOutput) {
    const templates = resolveTable("Templates");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.authorId, user.id));
  }

  async function versionsOf(templateId: string) {
    const versions = resolveTable("TemplateVersions");

    return await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .select()
      .from(versions)
      .where(eq(versions.templateId, templateId))
      .orderBy(asc(versions.version));
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setup({ isMarketplaceOn = true }: { isMarketplaceOn?: boolean } = {}) {
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const project = await seedProject({ organizationId: team.id });
    const tokens = new Map<string, string>();
    const disabledFlags: string[] = [FeatureFlags.ORGANIZATIONS_ENFORCE, ...(isMarketplaceOn ? [] : [FeatureFlags.TEMPLATE_MARKETPLACE])];

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => !disabledFlags.includes(flag));

    const request = (path: string, headers: Record<string, string>, init: { method?: string; body?: unknown }) =>
      app.request(path, {
        method: init.method ?? "GET",
        headers: { "content-type": "application/json", ...headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

    const read = (path: string, init: { method?: string; body?: unknown } = {}) => request(path, {}, init);

    const actAs = (user: UserOutput, { organizationId = team.id }: { organizationId?: string } = {}) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);

      return (path: string, init: { method?: string; body?: unknown } = {}) =>
        request(path, { authorization: `Bearer ${token}`, "x-organization-id": organizationId }, init);
    };

    const addMember = async (role: "member" | "admin", projectRole: "member" | "viewer") => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: projectRole });

      return user;
    };

    return { team, project, owner, read, actAs, addMember };
  }
});
