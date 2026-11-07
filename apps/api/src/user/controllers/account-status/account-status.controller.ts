import { singleton } from "tsyringe";

import type {
  AccountStatusEventListResponse,
  AccountStatusEventResponse,
  ReinstateAccountRequest,
  SuspendAccountRequest
} from "@src/user/http-schemas/account-status.schema";
import type { AccountStatusEventOutput } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { AccountStatusService } from "@src/user/services/account-status/account-status.service";

@singleton()
export class AccountStatusController {
  constructor(private readonly accountStatusService: AccountStatusService) {}

  async suspend(userId: string, { data }: SuspendAccountRequest): Promise<AccountStatusEventResponse> {
    return { data: toEventResponse(await this.accountStatusService.suspend(userId, data)) };
  }

  async reinstate(userId: string, { data }: ReinstateAccountRequest): Promise<AccountStatusEventResponse> {
    return { data: toEventResponse(await this.accountStatusService.reinstate(userId, data)) };
  }

  async listEvents(userId: string): Promise<AccountStatusEventListResponse> {
    const events = await this.accountStatusService.findEventsOf(userId);

    return { data: events.map(toEventResponse) };
  }
}

function toEventResponse(event: AccountStatusEventOutput): AccountStatusEventResponse["data"] {
  return {
    ...event,
    notificationSentAt: event.notificationSentAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString()
  };
}
