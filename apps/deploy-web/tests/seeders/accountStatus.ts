import type { AccountStatusDetails } from "@src/hooks/useAccountStatus/useAccountStatus";
import type { AccountStatus } from "@src/types/user";

export const buildAccountStatus = (status: AccountStatus, reason: string | null = null): AccountStatusDetails => ({
  status,
  reason,
  isSuspended: status === "suspended",
  isTerminated: status === "terminated",
  canSpend: status === "active",
  canMutate: status !== "terminated"
});
