import "@akashnetwork/env-loader";

import { Logger } from "@src/common/providers/logger.provider";

async function bootstrap() {
  const interfaceModule = process.env.INTERFACE || "all";

  try {
    const { bootstrap } = await import(`./interfaces/${interfaceModule}`);
    await bootstrap();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot find module")) {
      new Logger({ context: "BOOTSTRAP" }).error(`Unsupported interface "${interfaceModule}"`);
      process.exit(1);
    } else {
      throw error;
    }
  }
}

bootstrap();
