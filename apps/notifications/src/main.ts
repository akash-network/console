import "@akashnetwork/env-loader";

import { Logger } from "@src/common/providers/logger.provider";

async function bootstrap() {
  const interfaceModule = process.env.INTERFACE || "all";
  const logger = new Logger({ context: "BOOTSTRAP" });

  try {
    const { bootstrap } = await import(`./interfaces/${interfaceModule}`);
    await bootstrap();
    logger.info(`Successfully started with interface "${interfaceModule}".`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot find module")) {
      logger.error(`Unsupported interface "${interfaceModule}"`);
      process.exit(1);
    } else {
      throw error;
    }
  }
}

bootstrap();
