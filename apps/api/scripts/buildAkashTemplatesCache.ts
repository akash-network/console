import "@akashnetwork/env-loader";

import { TemplateGalleryService } from "../src/services/external/templates/template-gallery.service";

console.log("Warming up Akash templates cache...");
const githubPAT = process.env.GITHUB_PAT;
if (!githubPAT) {
  console.error("ERROR: requires GITHUB_PAT to be available in env variables");
  process.exit(1);
}

const templateGalleryService = new TemplateGalleryService({
  githubPAT,
  dataFolderPath: "./dist/.data"
});

templateGalleryService.getTemplateGallery().catch(err => {
  console.error("Encountered an error trying to warm up Akash templates cache");
  console.error(err);
  process.exit(1);
});
