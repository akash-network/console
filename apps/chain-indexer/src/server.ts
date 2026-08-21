import { createOtelLogger } from "@akashnetwork/logging/otel";

import { bootstrap } from "./index";

void bootstrap().catch(error => {
  createOtelLogger({ context: "APP" }).error({ event: "BOOTSTRAP_FAILED", error });
  process.exitCode = 1;
});
