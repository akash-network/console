import "@akashnetwork/env-loader";

import { getTemplateGallery } from "../src/services/external/templatesCollector";

console.log("Warming up Akash templates cache...");
const githubPAT = process.env.GITHUB_PAT;
if (!githubPAT) {
  console.error("ERROR: requires GITHUB_PAT to be available in env variables");
  process.exit(1);
}

getTemplateGallery({ githubPAT, dataFolderPath: "./dist/.data" }).catch(err => {
  console.error("Encountered an error trying to warm up Akash templates cache");
  console.error(err);
  process.exit(1);
});
