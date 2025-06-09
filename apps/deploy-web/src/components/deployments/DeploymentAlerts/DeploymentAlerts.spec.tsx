import { faker } from "@faker-js/faker";

import type { ChildrenProps } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import type { Props as DeploymentAlertsViewProps } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import { DeploymentAlertsView } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import type { DeploymentDto } from "@src/types/deployment";
import type { Props as DeploymentBalanceAlertProps } from "../DeploymentBalanceAlert/DeploymentBalanceAlert";
import type { Props as DeploymentCloseAlertProps } from "../DeploymentCloseAlert/DeploymentCloseAlert";

import { render, waitFor } from "@testing-library/react";

describe("DeploymentAlerts", () => {
  it("should pass data to children and trigger upsert on deployment close alert form submit", async () => {
    const { childrenProps, componentProps } = setup();

    await waitFor(() => {
      expect(childrenProps.DeploymentCloseAlert.initialValues).toEqual(componentProps.data?.alerts.deploymentClosed);
      expect(childrenProps.DeploymentBalanceAlert.initialValues).toEqual(componentProps.data?.alerts.deploymentBalance);
    });

    const closeAlertInput = {
      notificationChannelId: faker.string.uuid(),
      enabled: false
    };
    const balanceAlertInput = {
      notificationChannelId: faker.string.uuid(),
      threshold: faker.number.int(),
      enabled: false
    };

    childrenProps.DeploymentCloseAlert.onSubmit(closeAlertInput);
    childrenProps.DeploymentBalanceAlert.onSubmit(balanceAlertInput);

    expect(componentProps.upsert).toHaveBeenCalledWith({
      alerts: {
        deploymentClosed: closeAlertInput
      }
    });

    expect(componentProps.upsert).toHaveBeenCalledWith({
      alerts: {
        deploymentBalance: balanceAlertInput
      }
    });
  });

  function setup() {
    const childrenProps = {
      DeploymentCloseAlert: {} as DeploymentCloseAlertProps,
      DeploymentBalanceAlert: {} as DeploymentBalanceAlertProps
    };

    const COMPONENTS = {
      DeploymentCloseAlert: (props: DeploymentCloseAlertProps) => {
        childrenProps.DeploymentCloseAlert = props;
        return null;
      },
      DeploymentBalanceAlert: (props: DeploymentBalanceAlertProps) => {
        childrenProps.DeploymentBalanceAlert = props;
        return null;
      }
    };
    const dseq = faker.string.numeric();
    const componentProps: ChildrenProps & DeploymentAlertsViewProps = {
      deployment: { dseq } as DeploymentDto,
      upsert: jest.fn(),
      data: {
        dseq,
        alerts: {
          deploymentBalance: {
            id: faker.string.uuid(),
            status: "NORMAL",
            notificationChannelId: faker.string.uuid(),
            threshold: faker.number.int(),
            enabled: true
          },
          deploymentClosed: {
            id: faker.string.uuid(),
            status: "NORMAL",
            notificationChannelId: faker.string.uuid(),
            enabled: true
          }
        }
      },
      isFetched: true,
      isLoading: false,
      isError: false
    };

    render(<DeploymentAlertsView {...componentProps} components={COMPONENTS} />);

    return { childrenProps, componentProps };
  }
});
