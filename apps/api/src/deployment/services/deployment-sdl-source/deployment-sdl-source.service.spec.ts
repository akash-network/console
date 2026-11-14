import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { SdlPatchService } from "@src/deployment/services/sdl-patch/sdl-patch.service";
import type { TemplateGalleryService } from "@src/template/services/template-gallery/template-gallery.service";
import type { Template } from "@src/template/types/template";
import { DeploymentSdlSourceService } from "./deployment-sdl-source.service";

const TEMPLATE_SDL = `# kept as written
version: "2.0"
services:
  web:
    image: nginx:1.25.3
    env:
      - LOG_LEVEL=info
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

describe(DeploymentSdlSourceService.name, () => {
  describe("resolve", () => {
    it("answers the submitted SDL untouched, without reading the gallery", async () => {
      const { service, templateGalleryService } = setup();

      await expect(service.resolve({ sdl: "version: '2.0'", templateId: "nginx" })).resolves.toBe("version: '2.0'");
      expect(templateGalleryService.getTemplateById).not.toHaveBeenCalled();
    });

    it("answers an empty submitted SDL as it is, for validation to refuse", async () => {
      const { service, templateGalleryService } = setup();

      await expect(service.resolve({ sdl: "", templateId: "nginx" })).resolves.toBe("");
      expect(templateGalleryService.getTemplateById).not.toHaveBeenCalled();
    });

    it("writes the SDL of one service from simple inputs", async () => {
      const { service, templateGalleryService } = setup();

      const sdl = await service.resolve({
        service: {
          image: "ghcr.io/acme/api:1.4.0",
          resources: { cpu: 1, memory: "1Gi", storage: "2Gi" },
          ports: [{ port: 3000, as: 80 }],
          env: { LOG_LEVEL: "info" }
        }
      });

      expect(load(sdl)).toEqual({
        version: "2.0",
        services: { app: { image: "ghcr.io/acme/api:1.4.0", env: ["LOG_LEVEL=info"], expose: [{ port: 3000, as: 80, to: [{ global: true }] }] } },
        profiles: {
          compute: { app: { resources: { cpu: { units: 1 }, memory: { size: "1Gi" }, storage: { size: "2Gi" } } } },
          placement: { dcloud: { pricing: { app: { denom: "uact", amount: 100_000 } } } }
        },
        deployment: { app: { dcloud: { profile: "app", count: 1 } } }
      });
      expect(templateGalleryService.getTemplateById).not.toHaveBeenCalled();
    });

    it("keeps a long env value on one line", async () => {
      const { service } = setup();
      const longValue = "word ".repeat(80).trim();

      const sdl = await service.resolve({
        service: { image: "nginx:1.27.2", resources: { cpu: 1, memory: "1Gi", storage: "2Gi" }, ports: [{ port: 80 }], env: { LONG: longValue } }
      });

      expect(sdl).toContain(`LONG=${longValue}`);
    });

    it("answers the template's SDL as the gallery holds it when nothing overrides it", async () => {
      const { service, templateGalleryService } = setup();

      await expect(service.resolve({ templateId: "nginx" })).resolves.toBe(TEMPLATE_SDL);
      expect(templateGalleryService.getTemplateById).toHaveBeenCalledWith("nginx");
    });

    it("applies overrides to the template's SDL", async () => {
      const { service } = setup();

      const sdl = await service.resolve({ templateId: "nginx", overrides: { web: { image: "nginx:1.27.2", env: { LOG_LEVEL: "debug", API_KEY: "k" } } } });

      const document = load(sdl) as { services: { web: { image: string; env: string[] } }; profiles: unknown };
      expect(document.services.web.image).toBe("nginx:1.27.2");
      expect(document.services.web.env).toEqual(["LOG_LEVEL=debug", "API_KEY=k"]);
      expect(document.profiles).toEqual((load(TEMPLATE_SDL) as { profiles: unknown }).profiles);
    });

    it("keeps a long overridden value on one line", async () => {
      const { service } = setup();
      const longValue = "word ".repeat(80).trim();

      const sdl = await service.resolve({ templateId: "nginx", overrides: { web: { env: { LONG: longValue } } } });

      expect(sdl).toContain(`LONG=${longValue}`);
    });

    it("refuses overrides naming a service the template does not declare", async () => {
      const { service } = setup();

      await expect(service.resolve({ templateId: "nginx", overrides: { api: { image: "nginx:1.27.2" } } })).rejects.toMatchObject({
        status: 400,
        message: '"api" is not a service of this deployment'
      });
    });

    it("answers 404 for a template the gallery does not list", async () => {
      const { service } = setup({ template: null });

      await expect(service.resolve({ templateId: "missing" })).rejects.toMatchObject({ status: 404, message: "Template not found" });
    });

    it("answers 404 without reading the gallery when nothing names a source", async () => {
      const { service, templateGalleryService } = setup();

      await expect(service.resolve({})).rejects.toMatchObject({ status: 404, message: "Template not found" });
      expect(templateGalleryService.getTemplateById).not.toHaveBeenCalled();
    });

    it("refuses overrides for a template whose SDL cannot be read", async () => {
      const { service } = setup({ template: { deploy: "services: [unclosed" } });

      await expect(service.resolve({ templateId: "broken", overrides: { web: { image: "nginx:1.27.2" } } })).rejects.toMatchObject({
        status: 400,
        message: "The SDL of this template cannot be read, so it takes no overrides"
      });
    });
  });

  function setup(input?: { template?: Partial<Template> | null }) {
    const templateGalleryService = mock<TemplateGalleryService>();
    templateGalleryService.getTemplateById.mockResolvedValue(input?.template === null ? null : mock<Template>({ deploy: TEMPLATE_SDL, ...input?.template }));
    const service = new DeploymentSdlSourceService(templateGalleryService, new SdlPatchService());

    return { service, templateGalleryService };
  }
});
