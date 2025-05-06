import '@akashnetwork/env-loader';

import { NestFactory } from '@nestjs/core';

import { ShutdownService } from '@src/common/services/shutdown/shutdown.service';
import { HttpExceptionFilter } from '@src/interfaces/rest/filters/http-exception/http-exception.filter';
import { HttpResultInterceptor } from '@src/interfaces/rest/interceptors/http-result/http-result.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(loadInterface());

  app.enableShutdownHooks();
  app.get(ShutdownService).onShutdown(() => app.close());

  app.enableVersioning();
  app.useGlobalInterceptors(new HttpResultInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  await app.listen(process.env.PORT ?? 3000);
}

function loadInterface() {
  const module = process.env.INTERFACE || 'all';

  /* eslint-disable */
  if (module === 'all') {
    return require('./interfaces/all/all.module').default;
  }

  if (module === 'chain-events') {
    return require('./interfaces/chain-events/chain-events.module').default;
  }

  if (module === 'alert-events') {
    return require('./interfaces/alert-events/alert-events.module').default;
  }

  if (module === 'notifications-events') {
    return require('./interfaces/notifications-events/notifications-events.module')
      .default;
  }

  if (module === 'rest') {
    return require('./interfaces/rest/rest.module').default;
  }

  throw new Error(`Unknown INTERFACE: "${module}"`);
}

bootstrap();
