import { bootstrap } from "./index";

void bootstrap().catch(error => {
  console.error("Failed to bootstrap provider-inventory", error);
  process.exitCode = 1;
});
