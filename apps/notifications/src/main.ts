import '@akashnetwork/env-loader';

import { Logger } from '@src/common/providers/logger.provider';

async function bootstrap() {
  const module = process.env.INTERFACE || 'all';

  try {
    const { bootstrap } = await import(`./interfaces/${module}`);
    await bootstrap();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Cannot find module')
    ) {
      new Logger({ context: 'BOOTSTRAP' }).error(
        `Unsupported interface "${module}"`,
      );
      process.exit(1);
    } else {
      throw error;
    }
  }
}

bootstrap();
