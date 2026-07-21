import "@akashnetwork/env-loader";

import { Logger } from "@src/common/providers/logger.provider";

async function bootstrap() {
  const interfaceModuleName = process.env.INTERFACE || "all";
  const logger = new Logger({ context: "BOOTSTRAP" });

  const interfaceModule = await load(interfaceModuleName);

  if (!interfaceModule) {
    logger.error(`Unsupported interface "${interfaceModuleName}"`);
    process.exit(1);
  }

  await interfaceModule.bootstrap();
  logger.info(`Successfully started with interface "${interfaceModuleName}" with NODE_OPTIONS=${process.env.NODE_OPTIONS}.`);
}

async function load(interfaceModule: string): Promise<{ bootstrap: () => Promise<void> } | undefined> {
  if (interfaceModule === "alert-events") {
    return import("./interfaces/alert-events/index.ts");
  }

  if (interfaceModule === "all") {
    return import("./interfaces/all/index.ts");
  }

  if (interfaceModule === "chain-events") {
    return import("./interfaces/chain-events/index.ts");
  }

  if (interfaceModule === "notifications-events") {
    return import("./interfaces/notifications-events/index.ts");
  }

  if (interfaceModule === "rest") {
    return import("./interfaces/rest/index.ts");
  }

  if (interfaceModule === "swagger-gen") {
    return import("./interfaces/swagger-gen/index.ts");
  }

  return undefined;
}

bootstrap();
