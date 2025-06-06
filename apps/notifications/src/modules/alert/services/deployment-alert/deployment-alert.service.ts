import { MongoAbility } from "@casl/ability";
import { Injectable } from "@nestjs/common";

import { AlertInput, AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";

type DeploymentBalanceAlertInput = {
  contactPointId: string;
  enabled: boolean;
  threshold: number;
};

type DeploymentClosedAlertInput = {
  contactPointId: string;
  enabled: boolean;
};

export type DeploymentAlertInput = {
  dseq: string;
  owner: string;
  alerts: {
    deploymentBalance?: DeploymentBalanceAlertInput;
    deploymentClosed?: DeploymentClosedAlertInput;
  };
};

type DeploymentBalanceAlertOutput = DeploymentBalanceAlertInput & {
  id: string;
  status: string;
};

type DeploymentClosedAlertOutput = DeploymentClosedAlertInput & {
  id: string;
  status: string;
};

export type DeploymentAlertOutput = {
  dseq: string;
  alerts: {
    deploymentBalance?: DeploymentBalanceAlertOutput;
    deploymentClosed?: DeploymentClosedAlertOutput;
  };
};

type AuthMeta = {
  userId: string;
  ability: MongoAbility;
};

interface RepositoryAlert {
  id: string;
  contactPointId: string;
  enabled: boolean;
  status: string;
  type: string;
  params: Record<string, any>;
  conditions?: {
    field?: string;
    value: any;
    operator?: string;
  };
}

@Injectable()
export class DeploymentAlertService {
  constructor(private readonly alertRepository: AlertRepository) {}

  async upsert(clientInput: DeploymentAlertInput, auth: AuthMeta): Promise<DeploymentAlertOutput> {
    const { dseq, owner, alerts } = clientInput;

    const existingAlerts = await this.get(dseq, auth.ability);

    if (alerts.deploymentBalance) {
      await this.upsertBalanceAlert({ ...alerts.deploymentBalance, dseq, owner }, auth, existingAlerts);
    }

    if (alerts.deploymentClosed) {
      await this.upsertClosedAlert({ ...alerts.deploymentClosed, dseq, owner }, auth, existingAlerts);
    }

    return (await this.get(dseq, auth.ability)) as DeploymentAlertOutput;
  }

  private async upsertBalanceAlert(
    input: DeploymentBalanceAlertInput & { dseq: string; owner: string },
    auth: AuthMeta,
    existingAlerts: DeploymentAlertOutput
  ): Promise<void> {
    const existingBalanceAlert = existingAlerts.alerts.deploymentBalance;

    if (existingBalanceAlert) {
      await this.alertRepository.accessibleBy(auth.ability, "update").updateById(existingBalanceAlert.id, {
        contactPointId: input.contactPointId,
        enabled: input.enabled,
        conditions: {
          field: "balance",
          value: input.threshold,
          operator: "lt"
        }
      });
    } else {
      await this.alertRepository.accessibleBy(auth.ability, "create").create(this.toBalanceRepositoryInput(input, auth.userId));
    }
  }

  private async upsertClosedAlert(
    input: DeploymentClosedAlertInput & { dseq: string; owner: string },
    auth: AuthMeta,
    existingAlerts: DeploymentAlertOutput
  ): Promise<void> {
    const existingClosedAlert = existingAlerts.alerts.deploymentClosed;

    if (existingClosedAlert) {
      await this.alertRepository.accessibleBy(auth.ability, "update").updateById(existingClosedAlert.id, {
        contactPointId: input.contactPointId,
        enabled: input.enabled
      });
    } else {
      await this.alertRepository.accessibleBy(auth.ability, "create").create(this.toClosedRepositoryInput(input, auth.userId));
    }
  }

  private toBalanceRepositoryInput(input: DeploymentBalanceAlertInput & { dseq: string; owner: string }, userId: string): AlertInput {
    const { dseq, owner, threshold, contactPointId, enabled } = input;
    return {
      name: `Deployment ${dseq} balance`,
      userId,
      contactPointId,
      enabled,
      type: "DEPLOYMENT_BALANCE",
      params: {
        dseq,
        owner
      },
      conditions: {
        field: "balance",
        value: threshold,
        operator: "lt"
      },
      summary: `Deployment ${dseq} balance is below threshold`,
      description: `Deployment ${dseq} balance is below threshold`
    };
  }

  private toClosedRepositoryInput(input: DeploymentClosedAlertInput & { dseq: string; owner: string }, userId: string): AlertInput {
    const { dseq, owner, contactPointId, enabled } = input;
    return {
      name: `Deployment ${dseq} closed`,
      userId,
      contactPointId,
      enabled,
      type: "CHAIN_MESSAGE",
      params: {
        dseq,
        type: "DEPLOYMENT_CLOSED"
      },
      conditions: {
        value: [
          {
            field: "value.id.owner",
            value: owner,
            operator: "eq"
          },
          {
            field: "type",
            value: "akash.deployment.v1beta3.MsgCloseDeployment",
            operator: "eq"
          }
        ],
        operator: "and"
      },
      summary: `Deployment ${dseq} is closed`,
      description: `Deployment ${dseq} is closed`
    };
  }

  async get(dseq: string, ability: MongoAbility): Promise<DeploymentAlertOutput> {
    const alerts = (await this.alertRepository.accessibleBy(ability, "read").findAllDeploymentAlerts(dseq)) as RepositoryAlert[];

    const result: DeploymentAlertOutput = {
      dseq,
      alerts: {}
    };

    for (const alert of alerts) {
      if (alert.type === "DEPLOYMENT_BALANCE" && alert.conditions) {
        result.alerts.deploymentBalance = {
          id: alert.id,
          contactPointId: alert.contactPointId,
          enabled: alert.enabled,
          threshold: alert.conditions.value,
          status: alert.status
        };
      } else if (alert.type === "CHAIN_MESSAGE" && alert.params) {
        const params = alert.params as { dseq?: string; type?: string };
        if (params.type === "DEPLOYMENT_CLOSED") {
          result.alerts.deploymentClosed = {
            id: alert.id,
            contactPointId: alert.contactPointId,
            enabled: alert.enabled,
            status: alert.status
          };
        }
      }
    }

    return result;
  }
}
