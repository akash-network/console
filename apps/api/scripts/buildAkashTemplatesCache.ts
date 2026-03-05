import "reflect-metadata";
import "@akashnetwork/env-loader";

import { LoggerService } from "@akashnetwork/logging";
import { promises as fsp } from "node:fs";

import { GetTemplatesListResponseSchema } from "../src/template/http-schemas/template.schema";
import { TemplateGalleryService } from "../src/template/services/template-gallery/template-gallery.service";
import { dataFolderPath } from "../src/utils/constants";

console.log("Warming up Akash templates cache...");
const githubPAT = process.env.GITHUB_PAT;
if (!githubPAT) {
  console.error("ERROR: requires GITHUB_PAT to be available in env variables");
  process.exit(1);
}

const templateGalleryService = new TemplateGalleryService(LoggerService.forContext("TemplateGalleryService.script"), fsp, {
  githubPAT,
  dataFolderPath
});

templateGalleryService.buildTemplateGalleryCache(GetTemplatesListResponseSchema.shape.data).catch(err => {
  console.error("Encountered an error trying to warm up Akash templates cache");
  console.error(err);
  process.exit(1);
});
