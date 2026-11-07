import type { ComponentProps } from "react";

import { AccountMutationGate, AccountSpendGate } from "@src/components/user/AccountActionGate/AccountActionGate";
import type { AccountStatus } from "@src/types/user";

import { buildAccountStatus } from "@tests/seeders/accountStatus";
import { ComponentMock } from "@tests/unit/mocks";

type GateProps = ComponentProps<typeof AccountSpendGate>;

export function accountActionGatesFor(status: AccountStatus) {
  const dependencies = { useAccountStatus: () => buildAccountStatus(status), CustomTooltip: ComponentMock };

  return {
    AccountSpendGate: (props: GateProps) => <AccountSpendGate {...props} dependencies={dependencies} />,
    AccountMutationGate: (props: GateProps) => <AccountMutationGate {...props} dependencies={dependencies} />
  };
}
