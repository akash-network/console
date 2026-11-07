import { useUser } from "@src/hooks/useUser";
import type { AccountStatus } from "@src/types/user";

export const DEPENDENCIES = { useUser };

export type AccountStatusDetails = {
  status: AccountStatus;
  reason: string | null;
  isSuspended: boolean;
  isTerminated: boolean;
  canSpend: boolean;
  canMutate: boolean;
};

/** A profile loaded before the API reported a status is treated as active, since the API refuses whatever the account may no longer do. */
export function useAccountStatus(d: typeof DEPENDENCIES = DEPENDENCIES): AccountStatusDetails {
  const { user } = d.useUser();
  const status = user?.accountStatus ?? "active";

  return {
    status,
    reason: status === "active" ? null : user?.accountStatusReason ?? null,
    isSuspended: status === "suspended",
    isTerminated: status === "terminated",
    canSpend: status === "active",
    canMutate: status !== "terminated"
  };
}
