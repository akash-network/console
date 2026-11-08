import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import type { AccountStatusEventOutput, AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { CloseAccountDeployments } from "@src/user/services/close-account-deployments/close-account-deployments.job";
import { AccountStatusChangedHandler } from "./account-status-changed.handler";

describe(AccountStatusChangedHandler.name, () => {
  it("queues closing the deployments inside one transaction when the suspension asked for it", async () => {
    const userId = faker.string.uuid();
    const { handler, jobQueueService, calls } = setup({ event: { userId, action: "suspend", options: { closeDeployments: true } } });

    await handler.handle({ eventId: faker.string.uuid(), version: 1 });

    expect(calls).toEqual(["tx:begin", "enqueue", "tx:commit"]);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new CloseAccountDeployments({ userId }),
      expect.objectContaining({ singletonKey: `closeAccountDeployments.${userId}` })
    );
  });

  it("queues nothing for a suspension that kept the deployments", async () => {
    const { handler, jobQueueService } = setup({ event: { userId: faker.string.uuid(), action: "suspend", options: { closeDeployments: false } } });

    await handler.handle({ eventId: faker.string.uuid(), version: 1 });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("skips an event that does not exist", async () => {
    const eventId = faker.string.uuid();
    const { handler, txService, logger } = setup({ event: undefined });

    await handler.handle({ eventId, version: 1 });

    expect(txService.transaction).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "ACCOUNT_STATUS_CHANGE_SKIPPED", reason: "EVENT_NOT_FOUND", eventId });
  });

  it("skips an event whose user was deleted", async () => {
    const eventId = faker.string.uuid();
    const { handler, txService, logger } = setup({ event: { userId: null, action: "suspend", options: { closeDeployments: true } } });

    await handler.handle({ eventId, version: 1 });

    expect(txService.transaction).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "ACCOUNT_STATUS_CHANGE_SKIPPED", reason: "USER_DELETED", eventId });
  });

  function setup(input: { event: Pick<AccountStatusEventOutput, "userId" | "action" | "options"> | undefined }) {
    const calls: string[] = [];
    const accountStatusEventRepository = mock<AccountStatusEventRepository>();
    accountStatusEventRepository.findById.mockResolvedValue(input.event && mock<AccountStatusEventOutput>({ id: faker.string.uuid(), ...input.event }));
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockImplementation(async () => {
      calls.push("enqueue");
      return faker.string.uuid();
    });
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => {
      calls.push("tx:begin");
      const result = await cb();
      calls.push("tx:commit");
      return result;
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new AccountStatusChangedHandler(accountStatusEventRepository, jobQueueService, txService, createLogger);

    return { handler, calls, jobQueueService, txService, logger };
  }
});
