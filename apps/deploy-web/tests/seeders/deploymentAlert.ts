import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { faker } from "@faker-js/faker";

export function buildDeploymentAlert(
  overrides?: Partial<components["schemas"]["DeploymentAlertsResponse"]["data"]>
): components["schemas"]["DeploymentAlertsResponse"]["data"] {
  return {
    dseq: faker.string.numeric(),
    alerts: {
      deploymentBalance: {
        id: faker.string.uuid(),
        status: "NORMAL",
        notificationChannelId: faker.string.uuid(),
        threshold: faker.number.int({ min: 100, max: 1000 }),
        enabled: true
      },
      deploymentClosed: {
        id: faker.string.uuid(),
        status: "NORMAL",
        notificationChannelId: faker.string.uuid(),
        enabled: true
      }
    },
    ...overrides
  };
}
