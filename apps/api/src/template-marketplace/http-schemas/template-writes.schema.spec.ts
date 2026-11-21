import { describe, expect, it } from "vitest";

import { CreateUserTemplateRequestSchema, CreateUserTemplateVersionRequestSchema, UpdateUserTemplateRequestSchema } from "./template-writes.schema";

const SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx:1.27\n';
const SDL_MAX_LENGTH = 128 * 1024;
const RIGHT_TO_LEFT_OVERRIDE = "\u202e";

describe("template write schemas", () => {
  describe("title", () => {
    it.each(["create", "update"] as const)("is trimmed and limited to 80 characters on %s", request => {
      expect(parse(request, { title: `  ${"a".repeat(80)}  ` })).toEqual({ success: true, data: { data: expect.objectContaining({ title: "a".repeat(80) }) } });
      expect(parse(request, { title: "a".repeat(81) }).success).toBe(false);
    });

    it.each(["create", "update"] as const)("needs visible text without control characters on %s", request => {
      expect(parse(request, { title: "Open WebUI + vLLM \u{1f680}" }).success).toBe(true);
      expect(parse(request, { title: "   " }).success).toBe(false);
      expect(parse(request, { title: "\u200b" }).success).toBe(false);
      expect(parse(request, { title: "Open\nWebUI" }).success).toBe(false);
      expect(parse(request, { title: `Open ${RIGHT_TO_LEFT_OVERRIDE}IUbeW` }).success).toBe(false);
    });

    it("is required to create a template", () => {
      expect(CreateUserTemplateRequestSchema.safeParse({ data: { sdl: SDL } }).success).toBe(false);
    });
  });

  describe("summary", () => {
    it.each(["create", "update"] as const)("is trimmed and limited to 200 characters on %s", request => {
      expect(parse(request, { summary: ` ${"a".repeat(200)} ` })).toEqual({
        success: true,
        data: { data: expect.objectContaining({ summary: "a".repeat(200) }) }
      });
      expect(parse(request, { summary: "a".repeat(201) }).success).toBe(false);
    });

    it.each(["create", "update"] as const)("stays on one line without control characters on %s", request => {
      expect(parse(request, { summary: "" }).success).toBe(true);
      expect(parse(request, { summary: "Private chat\nOfficial" }).success).toBe(false);
      expect(parse(request, { summary: "Private chat\u0000" }).success).toBe(false);
      expect(parse(request, { summary: `Private ${RIGHT_TO_LEFT_OVERRIDE}tahc` }).success).toBe(false);
    });

    it("is cleared with null on update only", () => {
      expect(parse("update", { summary: null }).success).toBe(true);
      expect(parse("create", { summary: null }).success).toBe(false);
    });
  });

  describe("readme", () => {
    it.each(["create", "version"] as const)("is limited to 50,000 characters on %s", request => {
      expect(parse(request, { readme: "a".repeat(50_000) }).success).toBe(true);
      expect(parse(request, { readme: "a".repeat(50_001) }).success).toBe(false);
    });

    it.each(["create", "version"] as const)("keeps line breaks and tabs but no other control characters on %s", request => {
      expect(parse(request, { readme: "# Open WebUI\r\n\n\t- runs on one GPU" }).success).toBe(true);
      expect(parse(request, { readme: "# Open WebUI\u001b[2J" }).success).toBe(false);
      expect(parse(request, { readme: `[${RIGHT_TO_LEFT_OVERRIDE}moc.elpmaxe](https://attacker.example)` }).success).toBe(false);
    });

    it("is cleared with null on a new version only", () => {
      expect(parse("version", { readme: null }).success).toBe(true);
      expect(parse("create", { readme: null }).success).toBe(false);
    });
  });

  describe("sdl", () => {
    it.each(["create", "version"] as const)("is required and limited to 128 KiB of characters on %s", request => {
      expect(parse(request, { sdl: "a".repeat(SDL_MAX_LENGTH) }).success).toBe(true);
      expect(parse(request, { sdl: "a".repeat(SDL_MAX_LENGTH + 1) }).success).toBe(false);
      expect(parse(request, { sdl: "" }).success).toBe(false);
    });
  });

  describe("icon", () => {
    it.each(["create", "update"] as const)("is one of the catalog's icons on %s", request => {
      expect(parse(request, { icon: "rocket" }).success).toBe(true);
      expect(parse(request, { icon: "https://attacker.example/pixel.gif" }).success).toBe(false);
      expect(parse(request, { icon: "<svg onload=alert(1)>" }).success).toBe(false);
    });
  });

  describe("categories", () => {
    it.each(["create", "update"] as const)("are at most 3 distinct catalog categories on %s", request => {
      expect(parse(request, { categories: ["AI - GPU", "Chat", "Tools"] }).success).toBe(true);
      expect(parse(request, { categories: ["AI - GPU", "Chat", "Tools", "Games"] }).success).toBe(false);
      expect(parse(request, { categories: ["Chat", "Chat"] }).error?.issues).toEqual([expect.objectContaining({ message: "Categories must be unique" })]);
      expect(parse(request, { categories: ["<script>alert(1)</script>"] }).success).toBe(false);
    });
  });

  describe("asked values", () => {
    it.each(["create", "version"] as const)("are held to the asked value limits on %s", request => {
      const askedValue = { type: "text", key: "NAME", label: "Name", required: true, bindings: [{ service: "web", env: "NAME" }] };

      expect(parse(request, { askedValues: [askedValue] }).success).toBe(true);
      expect(parse(request, { askedValues: [{ ...askedValue, label: "a".repeat(81) }] }).success).toBe(false);
      expect(parse(request, { askedValues: [{ ...askedValue, help: `Your ${RIGHT_TO_LEFT_OVERRIDE}eman` }] }).success).toBe(false);
    });

    it("default to none when a template is created without them", () => {
      expect(CreateUserTemplateRequestSchema.parse({ data: { title: "Web", sdl: SDL } }).data.askedValues).toEqual([]);
    });
  });

  describe("settings update", () => {
    it("needs at least one setting", () => {
      expect(UpdateUserTemplateRequestSchema.safeParse({ data: {} }).error?.issues).toEqual([
        expect.objectContaining({ message: "Change at least one setting" })
      ]);
    });

    it("never makes a template public", () => {
      expect(parse("update", { visibility: "organization" }).success).toBe(true);
      expect(parse("update", { visibility: "public" }).success).toBe(false);
    });
  });

  function parse(request: "create" | "version" | "update", fields: Record<string, unknown>) {
    switch (request) {
      case "create":
        return CreateUserTemplateRequestSchema.safeParse({ data: { title: "Web", sdl: SDL, ...fields } });
      case "version":
        return CreateUserTemplateVersionRequestSchema.safeParse({ data: { sdl: SDL, askedValues: [], baseVersion: 1, ...fields } });
      default:
        return UpdateUserTemplateRequestSchema.safeParse({ data: fields });
    }
  }
});
