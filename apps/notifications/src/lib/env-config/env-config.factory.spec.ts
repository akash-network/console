import { ConfigService } from '@nestjs/config';
import { mock } from 'jest-mock-extended';
import { ZodRawShape } from 'zod';
import { ZodObject } from 'zod';

import { createConfigService } from './env-config.factory';

describe('createConfigService', () => {
  it('should create a config service', () => {
    const configSchema = mock<ZodObject<ZodRawShape>>();
    configSchema.parse.mockReturnValue({ PORT: '3000' });

    const { configService, ConfigServiceProvider } =
      createConfigService(configSchema);

    expect(configService).toBeInstanceOf(ConfigService);
    expect(ConfigServiceProvider).toMatchObject({
      provide: ConfigService,
      useValue: configService,
    });
    expect(configService.get('PORT')).toBe('3000');
  });
});
