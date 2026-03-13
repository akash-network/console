import { bootstrap } from "./index";

void bootstrap().catch(error => {
  console.error("Failed to bootstrap tx-signer", error);
  process.exitCode = 1;
});
