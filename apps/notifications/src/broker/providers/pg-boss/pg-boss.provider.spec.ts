import { ConfigService } from '@nestjs/config';
import { mock } from 'jest-mock-extended';
import { Client, QueryResult } from 'pg';
import PgBoss from 'pg-boss';

import { createPgBossFactory } from './pg-boss.provider';

describe('createPgBoss', () => {
  it('should create and start a PgBoss instance', async () => {
    const config = mock<ConfigService>();
    const client = mock<Client>();
    const postgresUri = 'postgres://user:password@localhost:5432/db';

    config.getOrThrow.mockReturnValue(postgresUri);

    const mockInstance = mock<PgBoss>();

    mockInstance.start.mockResolvedValue(mockInstance);

    const MockPgBoss = jest
      .fn()
      .mockImplementationOnce(() => mockInstance)
      .mockImplementationOnce(() => mockInstance);

    const pgBoss = await createPgBossFactory(
      MockPgBoss as unknown as typeof PgBoss,
    )(config, client);

    expect(MockPgBoss).toHaveBeenCalledTimes(2);
    expect(MockPgBoss.mock.calls[0][0]).toBe(postgresUri);
    expect(MockPgBoss.mock.calls[1][0]).toEqual({
      db: {
        executeSql: expect.any(Function),
      },
    });
    expect(mockInstance.start).toHaveBeenCalledTimes(2);
    expect(mockInstance.stop).toHaveBeenCalledTimes(1);
    expect(pgBoss).toBe(mockInstance);
  });

  it('should use client.query for executeSql', async () => {
    const config = mock<ConfigService>();
    const client = mock<Client>();
    const postgresUri = 'postgres://user:password@localhost:5432/db';

    config.getOrThrow.mockReturnValue(postgresUri);

    const mockQueryResult: QueryResult = {
      command: 'SELECT',
      rowCount: 0,
      oid: 0,
      rows: [],
      fields: [],
    };

    client.query.mockImplementation(() => Promise.resolve(mockQueryResult));

    type ExecuteSqlFn = (
      text: string,
      values: any[],
    ) => Promise<{ rows: any[] }>;
    let capturedExecuteSql: ExecuteSqlFn | undefined;

    const mockInstance = mock<PgBoss>();
    mockInstance.start.mockResolvedValue(mockInstance);

    const MockPgBoss = jest
      .fn()
      .mockImplementationOnce(() => mockInstance)
      .mockImplementationOnce((options) => {
        capturedExecuteSql = options.db.executeSql;
        return mockInstance;
      });

    await createPgBossFactory(MockPgBoss as unknown as typeof PgBoss)(
      config,
      client,
    );

    const sql = 'SELECT * FROM test';
    const values = [1, 2, 3];

    if (capturedExecuteSql) {
      await capturedExecuteSql(sql, values);

      expect(client.query).toHaveBeenCalledWith(sql, values);
    } else {
      fail('executeSql function was not captured');
    }
  });
});
