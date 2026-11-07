import createError from "http-errors";

import type { accountStatusActionEnum } from "@src/user/model-schemas/account-status-event/account-status-event.schema";
import type { accountStatusEnum } from "@src/user/model-schemas/user/user.schema";

export type AccountStatus = (typeof accountStatusEnum.enumValues)[number];

export type AccountStatusAction = (typeof accountStatusActionEnum.enumValues)[number];

export type AccountStatusActor = { staffId?: string; email: string; name: string };

export const ACCOUNT_SUSPENDED_ERROR_CODE = "account_suspended";
export const ACCOUNT_TERMINATED_ERROR_CODE = "account_terminated";
export const ACCOUNT_STATUS_CONFLICT_ERROR_CODE = "account_status_conflict";

const TRANSITIONS: Record<AccountStatusAction, { from: AccountStatus[]; to: AccountStatus }> = {
  suspend: { from: ["active"], to: "suspended" },
  reinstate: { from: ["suspended"], to: "active" },
  terminate: { from: ["active", "suspended"], to: "terminated" }
};

/** The status an action moves an account to, or undefined when the account's current status does not allow it. */
export function nextAccountStatusOf(current: AccountStatus, action: AccountStatusAction): AccountStatus | undefined {
  const transition = TRANSITIONS[action];

  return transition.from.includes(current) ? transition.to : undefined;
}

const REFUSAL_BY_STATUS = {
  suspended: { errorCode: ACCOUNT_SUSPENDED_ERROR_CODE, message: "Your account is suspended" },
  terminated: { errorCode: ACCOUNT_TERMINATED_ERROR_CODE, message: "Your account has been terminated" }
} as const;

/** The reason travels in `data`, because that is the only part of an http error the error handler copies into the response. */
export function createAccountStatusRefusal(status: Exclude<AccountStatus, "active">, reason: string | null) {
  const { errorCode, message } = REFUSAL_BY_STATUS[status];

  return createError(403, message, { errorCode, data: { reason } });
}
