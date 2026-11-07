import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AccountStatusEventOutput } from "@src/user/repositories/account-status-event/account-status-event.repository";
import type { AccountStatusService } from "@src/user/services/account-status/account-status.service";
import { AccountStatusController } from "./account-status.controller";

describe(AccountStatusController.name, () => {
  it("suspends the user with the request's data and answers with the event, dates as ISO strings", async () => {
    const { controller, accountStatusService, userId, actor, event } = setup({ notificationSentAt: null });
    accountStatusService.suspend.mockResolvedValue(event);
    const data = { actor, userReason: "Unpaid invoices", closeDeployments: true };

    const response = await controller.suspend(userId, { data });

    expect(accountStatusService.suspend).toHaveBeenCalledWith(userId, data);
    expect(response).toEqual({ data: { ...event, createdAt: event.createdAt.toISOString(), notificationSentAt: null } });
  });

  it("reinstates the user with the request's data", async () => {
    const { controller, accountStatusService, userId, actor, event } = setup({ notificationSentAt: null });
    accountStatusService.reinstate.mockResolvedValue(event);
    const data = { actor, note: "Paid in full" };

    const response = await controller.reinstate(userId, { data });

    expect(accountStatusService.reinstate).toHaveBeenCalledWith(userId, data);
    expect(response.data.id).toBe(event.id);
  });

  it("terminates the user with the request's data and answers with the event", async () => {
    const { controller, accountStatusService, userId, actor, event } = setup({ notificationSentAt: null });
    accountStatusService.terminate.mockResolvedValue(event);
    const data = { actor, userReason: "Fraud", forfeitCredits: true };

    const response = await controller.terminate(userId, { data });

    expect(accountStatusService.terminate).toHaveBeenCalledWith(userId, data);
    expect(response).toEqual({ data: { ...event, createdAt: event.createdAt.toISOString(), notificationSentAt: null } });
  });

  it("lists the user's events with when their email went out", async () => {
    const notificationSentAt = faker.date.recent();
    const { controller, accountStatusService, userId, event } = setup({ notificationSentAt });
    accountStatusService.findEventsOf.mockResolvedValue([event]);

    const response = await controller.listEvents(userId);

    expect(accountStatusService.findEventsOf).toHaveBeenCalledWith(userId);
    expect(response.data).toEqual([expect.objectContaining({ id: event.id, notificationSentAt: notificationSentAt.toISOString() })]);
  });

  function setup(input: { notificationSentAt: Date | null }) {
    const userId = faker.string.uuid();
    const actor = { staffId: faker.string.uuid(), email: faker.internet.email(), name: faker.person.fullName() };
    const event: AccountStatusEventOutput = {
      id: faker.string.uuid(),
      userId,
      userEmail: faker.internet.email(),
      action: "suspend",
      actorStaffId: actor.staffId,
      actorEmail: actor.email,
      actorName: actor.name,
      userReason: "Unpaid invoices",
      internalNote: null,
      options: { closeDeployments: true },
      notificationSentAt: input.notificationSentAt,
      createdAt: faker.date.recent()
    };
    const accountStatusService = mock<AccountStatusService>();
    const controller = new AccountStatusController(accountStatusService);

    return { controller, accountStatusService, userId, actor, event };
  }
});
