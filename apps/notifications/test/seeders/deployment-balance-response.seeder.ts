import { faker } from '@faker-js/faker';

import type { DeploymentInfo } from '@src/alert/services/deployment/deployment.service';

export const generateDeploymentBalanceResponse = ({
  escrowAmount = faker.number.int({ min: 0, max: 10000 }),
  fundsAmount = faker.number.int({ min: 0, max: 10000 }),
  state = 'active',
}: {
  escrowAmount: number;
  fundsAmount: number;
  state: 'active' | 'closed';
}): DeploymentInfo => {
  return {
    deployment: {
      state,
    },
    escrow_account: {
      balance: {
        denom: 'uakt',
        amount: String(escrowAmount),
      },
      funds: {
        denom: 'uakt',
        amount: String(fundsAmount),
      },
    },
  };
};
