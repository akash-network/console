import { bootstrap } from "./index";

void bootstrap().catch(error => {
  console.error("Failed to bootstrap chain-indexer", error);
  process.exitCode = 1;
});
