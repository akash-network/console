import type { DeploymentInfo } from "@akashnetwork/http-sdk";
import { DeploymentInfoSchema } from "@akashnetwork/http-sdk";
import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";

export const generateDeploymentBalanceResponse = ({
  funds = [{ denom: "uakt", amount: faker.number.int({ min: 0, max: 10000 }) }],
  settledAt = faker.number.int({ min: 1, max: 1000 }),
  state = "active"
}: {
  funds: { denom: string; amount: number }[];
  state: "active" | "closed";
  settledAt?: number;
}): DeploymentInfo => {
  const deploymentInfo = generateMock(DeploymentInfoSchema);

  if (funds) {
    deploymentInfo.escrow_account.state.funds = funds.map(({ denom, amount }) => ({ denom, amount: String(amount) }));
  }

  if (settledAt) {
    deploymentInfo.escrow_account.state.settled_at = String(settledAt);
  }

  if (state) {
    deploymentInfo.deployment.state = state;
  }

  return deploymentInfo;
};
