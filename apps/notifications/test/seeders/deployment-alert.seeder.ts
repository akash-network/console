import { faker } from "@faker-js/faker";

import type { DeploymentAlertInput, DeploymentAlertOutput } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";

export const generateDeploymentBalanceAlertInput = ({
  dseq = faker.string.numeric(),
  owner = mockAkashAddress(),
  notificationChannelId = faker.string.uuid(),
  enabled = true,
  threshold = faker.number.int({ min: 1000, max: 100000 })
}: Partial<DeploymentAlertInput> &
  Partial<{
    notificationChannelId: string;
    enabled: boolean;
    threshold: number;
  }>): Omit<DeploymentAlertInput, "alerts"> & {
  alerts: {
    deploymentBalance: NonNullable<DeploymentAlertInput["alerts"]["deploymentBalance"]>;
    deploymentClosed: NonNullable<DeploymentAlertInput["alerts"]["deploymentClosed"]>;
  };
} => {
  return {
    dseq,
    owner,
    alerts: {
      deploymentBalance: {
        notificationChannelId,
        enabled,
        threshold
      },
      deploymentClosed: {
        notificationChannelId,
        enabled
      }
    }
  };
};

export const generateDeploymentBalanceAlertOutput = (
  overrides: Partial<DeploymentAlertOutput> &
    Partial<{
      notificationChannelId: string;
      enabled: boolean;
      threshold: number;
    }>
): Omit<DeploymentAlertOutput, "alerts"> & {
  alerts: {
    deploymentBalance: NonNullable<DeploymentAlertOutput["alerts"]["deploymentBalance"]>;
    deploymentClosed: NonNullable<DeploymentAlertOutput["alerts"]["deploymentClosed"]>;
  };
} => {
  const { alerts, dseq } = generateDeploymentBalanceAlertInput(overrides);

  return {
    dseq,
    alerts: {
      deploymentBalance: alerts.deploymentBalance && {
        ...alerts.deploymentBalance,
        id: faker.string.uuid(),
        status: "OK"
      },
      deploymentClosed: alerts.deploymentClosed && {
        ...alerts.deploymentClosed,
        id: faker.string.uuid(),
        status: "OK"
      }
    }
  };
};
