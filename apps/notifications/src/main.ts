import '@akashnetwork/env-loader';

import { NestFactory } from '@nestjs/core';

import { ShutdownService } from '@src/common/services/shutdown/shutdown.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.get(ShutdownService).onShutdown(() => app.close());

  await app.init();
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
