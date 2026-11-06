import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { FileSystemApi } from "../../services/template-gallery/template-gallery.service";
import { TemplateGalleryService } from "../../services/template-gallery/template-gallery.service";
import { TemplateController } from "./template.controller";

const DART_SDL = `
version: "2.0"
services:
  dart:
    image: google/dart-hello
profiles:
  compute:
    dart:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    akash:
      attributes:
        host: akash
      signedBy:
        anyOf:
          - akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63
      pricing:
        dart:
          denom: uact
          amount: 10000
deployment:
  dart:
    akash:
      profile: dart
      count: 1
`;

describe(TemplateController.name, () => {
  describe("getTemplateById", () => {
    it("hands deployment proposals and the deploy flow a gallery template's SDL without its placement attributes", async () => {
      const { controller } = setup({ storedTemplate: { id: "akash-network-awesome-akash-dart", deploy: DART_SDL } });

      const { data } = await controller.getTemplateById("akash-network-awesome-akash-dart");

      expect(load(data.deploy)).toMatchObject({
        profiles: {
          placement: {
            akash: {
              signedBy: { anyOf: ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"] },
              pricing: { dart: { denom: "uact", amount: 10000 } }
            }
          }
        }
      });
      expect(load(data.deploy)).not.toHaveProperty("profiles.placement.akash.attributes");
    });

    it("answers 404 for a template the gallery does not have", async () => {
      const { controller } = setup({ storedTemplate: null });

      await expect(controller.getTemplateById("missing")).rejects.toMatchObject({ status: 404 });
    });
  });

  function setup(input: { storedTemplate: { id: string; deploy: string } | null }) {
    const fs = mock<FileSystemApi>();
    if (input.storedTemplate) {
      fs.readFile.mockResolvedValue(JSON.stringify({ data: input.storedTemplate }));
    } else {
      fs.readFile.mockRejectedValue(new Error("ENOENT"));
    }
    const galleryService = new TemplateGalleryService(mock<ReturnType<CreateLogger>>(), fs, { dataFolderPath: "/data" });
    const controller = new TemplateController(galleryService);

    return { controller };
  }
});
