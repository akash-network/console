import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import type { DocumentBuilder } from "@nestjs/swagger";
import type fs from "fs";
import type { patchNestJsSwagger } from "nestjs-zod";
import type path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type SwaggerModuleAPI, SwaggerSetup } from "./swagger-setup";

describe("SwaggerSetup", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("serveSwagger", () => {
    it("mounts a swagger UI for both the public and internal scopes", () => {
      const { swaggerSetup, swaggerModule, app } = setup();

      swaggerSetup.serveSwagger();

      expect(swaggerModule.setup).toHaveBeenCalledTimes(2);
      expect(swaggerModule.setup).toHaveBeenNthCalledWith(1, "api", app, expect.any(Function), expect.any(Object));
      expect(swaggerModule.setup).toHaveBeenNthCalledWith(2, "api/internal", app, expect.any(Function), expect.any(Object));
    });
  });

  describe("generateSwagger", () => {
    it("creates the swagger directory if it does not exist", () => {
      const { swaggerSetup, fsModule } = setup({ swaggerDirExists: false });

      expect(() => swaggerSetup.generateSwagger()).toThrow("EXIT(0)");

      expect(fsModule.mkdirSync).toHaveBeenCalledTimes(1);
    });

    it("does not recreate the swagger directory when it already exists", () => {
      const { swaggerSetup, fsModule } = setup({ swaggerDirExists: true });

      expect(() => swaggerSetup.generateSwagger()).toThrow("EXIT(0)");

      expect(fsModule.mkdirSync).not.toHaveBeenCalled();
    });

    it("writes one file per scope and exits with status 0", () => {
      const { swaggerSetup, fsModule, exitSpy } = setup();

      expect(() => swaggerSetup.generateSwagger()).toThrow("EXIT(0)");

      const writtenFiles = (fsModule.writeFileSync as unknown as ReturnType<typeof vi.fn>).mock.calls.map(args => args[0]);
      expect(writtenFiles).toHaveLength(2);
      expect(writtenFiles[0]).toMatch(/swagger\.json$/);
      expect(writtenFiles[1]).toMatch(/swagger\.internal\.json$/);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("createSwaggerDocument (via serveSwagger)", () => {
    it("filters /internal/ paths out of the public document factory", () => {
      const { swaggerSetup, swaggerModule } = setup({
        documentPaths: { "/v1/things": pathItem(), "/internal/users/{userId}/purge": pathItem() }
      });

      swaggerSetup.serveSwagger();
      const publicFactory = (swaggerModule.setup as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2] as () => OpenAPIObject;
      const internalFactory = (swaggerModule.setup as unknown as ReturnType<typeof vi.fn>).mock.calls[1][2] as () => OpenAPIObject;

      const publicDoc = publicFactory();
      const internalDoc = internalFactory();

      expect(Object.keys(publicDoc.paths)).toEqual(["/v1/things"]);
      expect(Object.keys(internalDoc.paths)).toEqual(["/internal/users/{userId}/purge"]);
    });
  });

  function setup(
    input: {
      documentPaths?: OpenAPIObject["paths"];
      swaggerDirExists?: boolean;
    } = {}
  ) {
    const documentPaths = input.documentPaths ?? {};
    const baseDocument: OpenAPIObject = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0" },
      paths: documentPaths,
      components: { schemas: {} }
    };

    const app = mock<INestApplication>();
    const patchSwagger = vi.fn() as unknown as typeof patchNestJsSwagger;
    const documentBuilder = MockDocumentBuilder as unknown as typeof DocumentBuilder;
    const swaggerModule = mock<SwaggerModuleAPI>({
      setup: vi.fn(),
      createDocument: vi.fn(() => baseDocument)
    });
    const fsModule = mock<typeof fs>({
      existsSync: vi.fn().mockReturnValue(input.swaggerDirExists ?? true),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn()
    });
    const pathModule = mock<typeof path>({
      resolve: vi.fn((...parts: string[]) => parts.join("/")),
      join: vi.fn((...parts: string[]) => parts.join("/"))
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT(${code ?? 0})`);
    }) as never);

    const swaggerSetup = new SwaggerSetup(app, patchSwagger, documentBuilder, swaggerModule, fsModule, pathModule);

    return { swaggerSetup, app, patchSwagger, documentBuilder, swaggerModule, fsModule, pathModule, exitSpy };
  }
});

class MockDocumentBuilder {
  setTitle = vi.fn().mockReturnThis();
  setDescription = vi.fn().mockReturnThis();
  setVersion = vi.fn().mockReturnThis();
  addTag = vi.fn().mockReturnThis();
  addApiKey = vi.fn().mockReturnThis();
  addSecurityRequirements = vi.fn().mockReturnThis();
  build = vi.fn(() => ({}));
}

function pathItem(): Record<string, unknown> {
  return {
    get: {
      responses: { "200": { description: "ok" } }
    }
  };
}
