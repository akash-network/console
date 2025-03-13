import { ConfigService } from '@nestjs/config';
import { mock } from 'jest-mock-extended';
import { Client } from 'pg';

import { createPgClientFactory } from './db.provider';

describe('createPgClient', () => {
  it('should create a client with the correct connection string', async () => {
    const config = mock<ConfigService>();
    const postgresUri = 'postgres://user:password@localhost:5432/db';
    config.getOrThrow.mockReturnValue(postgresUri);

    const clientInstance = mock<Client>();
    const MockClient = jest.fn().mockImplementation(() => clientInstance);

    const client = await createPgClientFactory(
      MockClient as unknown as typeof Client,
    )(config);

    expect(MockClient).toHaveBeenCalledWith(postgresUri);
    expect(client.connect).toHaveBeenCalled();
  });
});
