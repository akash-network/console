import { Test, type TestingModule } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Pool } from "pg";
import PgBoss from "pg-boss";

import { PgBossHandlerService } from "@src/infrastructure/broker/services/pg-boss-handler/pg-boss-handler.service";
import { StateService } from "./state.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(StateService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  it("should initialize with state 'stopped'", async () => {
    const { service } = await setup();
    expect(service.getState()).toBe("stopped");
  });

  it("should set state to 'active' after bootstrap", async () => {
    const { service, pgBossHandlerService } = await setup();

    await service.onApplicationBootstrap();

    expect(pgBossHandlerService.startAllHandlers).toHaveBeenCalled();
    expect(service.getState()).toBe("active");
  });

  it("should stop pgBoss and pg pool and set state to 'stopped' on shutdown", async () => {
    const { service, boss, pg } = await setup();

    await service.onApplicationShutdown();

    expect(boss.stop).toHaveBeenCalled();
    expect(pg.end).toHaveBeenCalled();
    expect(service.getState()).toBe("stopped");
  });

  it("should update state to 'stopped' when PgBoss emits 'stopped'", async () => {
    const { service, boss } = await setup();

    const stoppedListener = boss.on.mock.calls.find(([event]) => event === "stopped")?.[1];
    expect(stoppedListener).toBeDefined();

    stoppedListener?.();

    expect(service.getState()).toBe("stopped");
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: StateService;
    pgBossHandlerService: MockProxy<PgBossHandlerService>;
    boss: MockProxy<PgBoss>;
    pg: MockProxy<Pool>;
  }> {
    const module = await Test.createTestingModule({
      providers: [StateService, MockProvider(PgBossHandlerService), MockProvider(PgBoss), MockProvider(Pool)]
    }).compile();

    const service = module.get(StateService);
    const pgBossHandlerService = module.get<MockProxy<PgBossHandlerService>>(PgBossHandlerService);
    const boss = module.get<MockProxy<PgBoss>>(PgBoss);
    const pg = module.get<MockProxy<Pool>>(Pool);

    return {
      module,
      service,
      pgBossHandlerService,
      boss,
      pg
    };
  }
});
