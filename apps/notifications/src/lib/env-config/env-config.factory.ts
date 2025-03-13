import { ConfigService } from '@nestjs/config';
import * as process from 'node:process';
import { ZodObject, ZodRawShape } from 'zod';

export const createConfigService = <E extends ZodObject<ZodRawShape>>(
  schema: E,
) => {
  const configService = new ConfigService(schema.parse(process.env));

  return {
    configService,
    ConfigServiceProvider: {
      provide: ConfigService,
      useValue: configService,
    },
  };
};
