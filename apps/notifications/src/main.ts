import "@akashnetwork/env-loader";

import { Logger } from "@src/common/providers/logger.provider";

async function bootstrap() {
  const interfaceModuleName = process.env.INTERFACE || "all";
  const logger = new Logger({ context: "BOOTSTRAP" });

  const interfaceModule = load(interfaceModuleName);

  if (!interfaceModule) {
    logger.error(`Unsupported interface "${interfaceModuleName}"`);
    process.exit(1);
  }

  await interfaceModule.bootstrap();
  logger.info(`Successfully started with interface "${interfaceModuleName}" with NODE_OPTIONS=${process.env.NODE_OPTIONS}.`);
}

function load(interfaceModule: string): { bootstrap: () => Promise<void> } | undefined {
  if (interfaceModule === "alert-events") {
    return require("./interfaces/alert-events");
  }

  if (interfaceModule === "all") {
    return require("./interfaces/all");
  }

  if (interfaceModule === "chain-events") {
    return require("./interfaces/chain-events");
  }

  if (interfaceModule === "notifications-events") {
    return require("./interfaces/notifications-events");
  }

  if (interfaceModule === "rest") {
    return require("./interfaces/rest");
  }

  if (interfaceModule === "swagger-gen") {
    return require("./interfaces/swagger-gen");
  }

  return undefined;
}

bootstrap();
