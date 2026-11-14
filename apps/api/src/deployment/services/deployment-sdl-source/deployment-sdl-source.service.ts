import createError from "http-errors";
import { dump } from "js-yaml";
import { inject, singleton } from "tsyringe";

import type { CreateDeploymentRequest } from "@src/deployment/http-schemas/deployment.schema";
import { SdlPatchService } from "@src/deployment/services/sdl-patch/sdl-patch.service";
import { parseSdlForStorage } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { buildServiceSdl } from "@src/deployment/utils/service-sdl/service-sdl";
import { TEMPLATE_GALLERY_SERVICE } from "@src/template/providers/template-gallery.provider";
import { TemplateGalleryService } from "@src/template/services/template-gallery/template-gallery.service";

type DeploymentSdlSource = Pick<CreateDeploymentRequest["data"], "sdl" | "service" | "templateId" | "overrides">;

type TemplateOverrides = NonNullable<DeploymentSdlSource["overrides"]>;

/** Turns whatever a create named as its source into the SDL it deploys, so a create sent without an SDL is stored and deployed like one sent with it. */
@singleton()
export class DeploymentSdlSourceService {
  constructor(
    @inject(TEMPLATE_GALLERY_SERVICE) private readonly templateGalleryService: TemplateGalleryService,
    private readonly sdlPatchService: SdlPatchService
  ) {}

  async resolve(source: DeploymentSdlSource): Promise<string> {
    if (source.sdl !== undefined) return source.sdl;
    if (source.service) return dump(buildServiceSdl(source.service), { lineWidth: -1 });

    const templateSdl = await this.#templateSdlOf(source.templateId);

    return source.overrides ? this.#withOverrides(templateSdl, source.overrides) : templateSdl;
  }

  async #templateSdlOf(templateId: string | undefined): Promise<string> {
    const template = templateId ? await this.templateGalleryService.getTemplateById(templateId) : null;

    if (!template) throw createError(404, "Template not found");

    return template.deploy;
  }

  #withOverrides(templateSdl: string, overrides: TemplateOverrides): string {
    const { document } = parseSdlForStorage(templateSdl);

    if (!document) throw createError(400, "The SDL of this template cannot be read, so it takes no overrides");

    this.sdlPatchService.apply(document, overrides);

    return dump(document, { lineWidth: -1 });
  }
}
