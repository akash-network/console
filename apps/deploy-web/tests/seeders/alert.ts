import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { faker } from "@faker-js/faker";

type Alert = components["schemas"]["AlertOutputResponse"]["data"];
type ChainMessageAlert = Extract<Alert, { type: "CHAIN_MESSAGE" }>;
type DeploymentBalanceAlert = Extract<Alert, { type: "DEPLOYMENT_BALANCE" }>;

export function buildAlert(overrides?: Partial<Alert>): Alert {
  if (overrides?.type === "DEPLOYMENT_BALANCE") {
    return buildDeploymentBalanceAlert(overrides);
  }

  if (overrides?.type === "CHAIN_MESSAGE") {
    return buildChainMessageAlert(overrides);
  }

  return buildChainMessageAlert();
}

function buildChainMessageAlert(overrides?: Partial<ChainMessageAlert>): ChainMessageAlert {
  return {
    id: faker.string.uuid(),
    name: faker.lorem.words(2),
    conditions: {
      operator: faker.helpers.arrayElement(["eq", "lt", "gt", "lte", "gte"]),
      field: faker.lorem.word(),
      value: faker.string.uuid()
    },
    summary: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement(["NORMAL", "FIRING", "FIRED"]),
    enabled: faker.datatype.boolean(),
    contactPointId: faker.string.uuid(),
    userId: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    params: {
      dseq: faker.number.int({ min: 1000, max: 999999 }).toString(),
      type: faker.helpers.arrayElement(["akash.deployment.v1beta3.MsgCreateDeployment", "akash.deployment.v1beta3.MsgCloseDeployment"])
    },
    ...overrides,
    type: "CHAIN_MESSAGE"
  };
}

function buildDeploymentBalanceAlert(overrides?: Partial<DeploymentBalanceAlert>): DeploymentBalanceAlert {
  return {
    id: faker.string.uuid(),
    name: faker.lorem.words(2),
    conditions: {
      operator: faker.helpers.arrayElement(["eq", "lt", "gt", "lte", "gte"]),
      field: "balance",
      value: faker.number.int({ min: 0, max: 1000 })
    },
    summary: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement(["NORMAL", "FIRING", "FIRED"]),
    enabled: faker.datatype.boolean(),
    contactPointId: faker.string.uuid(),
    userId: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    params: {
      dseq: faker.number.int({ min: 1000, max: 999999 }).toString(),
      owner: faker.string.uuid()
    },
    ...overrides,
    type: "DEPLOYMENT_BALANCE"
  };
}
