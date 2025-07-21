import { MongoAbility } from "@casl/ability";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Err, Ok, Result } from "ts-results";

import { AlertConfig } from "@src/modules/alert/config";
import { AlertInput, AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { DeploymentService } from "@src/modules/alert/services/deployment/deployment.service";

type DeploymentBalanceAlertInput = {
  notificationChannelId: string;
  enabled: boolean;
  threshold: number;
};

type DeploymentClosedAlertInput = {
  notificationChannelId: string;
  enabled: boolean;
};

export type DeploymentAlertInput = {
  dseq: string;
  owner?: string;
  alerts: {
    deploymentBalance?: DeploymentBalanceAlertInput;
    deploymentClosed?: DeploymentClosedAlertInput;
  };
};

type DeploymentBalanceAlertOutput = DeploymentBalanceAlertInput & {
  id: string;
  status: string;
  suppressedBySystem?: boolean;
};

type DeploymentClosedAlertOutput = DeploymentClosedAlertInput & {
  id: string;
  status: string;
  suppressedBySystem?: boolean;
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
  notificationChannelId: string;
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
  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly alertRepository: AlertRepository,
    private configService: ConfigService<AlertConfig>
  ) {}

  async upsert(clientInput: DeploymentAlertInput, auth: AuthMeta): Promise<Result<DeploymentAlertOutput, unknown>> {
    const { dseq, owner, alerts } = clientInput;

    if (!owner || !(await this.deploymentService.deploymentExists(owner, dseq))) {
      return Err(new NotFoundException("Deployment not found"));
    }

    const existingAlerts = await this.get(dseq, auth.ability);
    if (existingAlerts.alerts.deploymentBalance?.suppressedBySystem || existingAlerts.alerts.deploymentClosed?.suppressedBySystem) {
      return Err(new BadRequestException("Cannot upsert because deployment alert is suppressed by system"));
    }

    if (alerts.deploymentBalance) {
      await this.upsertBalanceAlert({ ...alerts.deploymentBalance, dseq, owner }, auth, existingAlerts);
    }

    if (alerts.deploymentClosed) {
      await this.upsertClosedAlert({ ...alerts.deploymentClosed, dseq, owner }, auth, existingAlerts);
    }

    return Ok((await this.get(dseq, auth.ability)) as DeploymentAlertOutput);
  }

  private async upsertBalanceAlert(
    input: DeploymentBalanceAlertInput & { dseq: string; owner: string },
    auth: AuthMeta,
    existingAlerts: DeploymentAlertOutput
  ): Promise<void> {
    const existingBalanceAlert = existingAlerts.alerts.deploymentBalance;

    if (existingBalanceAlert) {
      await this.alertRepository.accessibleBy(auth.ability, "update", "DeploymentAlert").updateById(existingBalanceAlert.id, {
        notificationChannelId: input.notificationChannelId,
        enabled: input.enabled,
        conditions: {
          field: "balance",
          value: input.threshold,
          operator: "lt"
        }
      });
    } else {
      await this.alertRepository.accessibleBy(auth.ability, "create", "DeploymentAlert").create(this.toBalanceRepositoryInput(input, auth.userId));
    }
  }

  private async upsertClosedAlert(
    input: DeploymentClosedAlertInput & { dseq: string; owner: string },
    auth: AuthMeta,
    existingAlerts: DeploymentAlertOutput
  ): Promise<void> {
    const existingClosedAlert = existingAlerts.alerts.deploymentClosed;

    if (existingClosedAlert) {
      await this.alertRepository.accessibleBy(auth.ability, "update", "DeploymentAlert").updateById(existingClosedAlert.id, {
        notificationChannelId: input.notificationChannelId,
        enabled: input.enabled
      });
    } else {
      await this.alertRepository.accessibleBy(auth.ability, "create", "DeploymentAlert").create(this.toClosedRepositoryInput(input, auth.userId));
    }
  }

  private toBalanceRepositoryInput(input: DeploymentBalanceAlertInput & { dseq: string; owner: string }, userId: string): AlertInput {
    const { dseq, owner, threshold, notificationChannelId, enabled } = input;
    const consoleLink = this.getConsoleLink(dseq);
    return {
      name: `Deployment ${dseq} balance`,
      userId,
      notificationChannelId,
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
      summary: this.getTemplate({
        suspended: "Deployment {{alert.next.params.dseq}} balance alert is suspended",
        triggered: "Deployment {{alert.next.params.dseq}} balance is below threshold",
        recovered: "Deployment {{alert.next.params.dseq}} balance is above threshold"
      }),
      description: this.getTemplate({
        suspended: `Deployment was closed. Please visit ${consoleLink} to manage your deployment.`,
        triggered: `Please visit ${consoleLink} to add more funds to your deployment before it is closed.`,
        recovered: `Escrow account is above threshold. You'll be notified again next time your account threshold is hit. Please visit ${consoleLink} to manage your deployment`
      })
    };
  }

  private getTemplate(templates: { triggered: string; recovered: string; suspended: string }): string {
    return `{{#if (eq data.cause "DEPLOYMENT_CLOSED")}}${templates.suspended}{{else}}{{#if (eq alert.next.status "TRIGGERED")}}${templates.triggered}{{else}}${templates.recovered}{{/if}}{{/if}}`;
  }

  private toClosedRepositoryInput(input: DeploymentClosedAlertInput & { dseq: string; owner: string }, userId: string): AlertInput {
    const { dseq, owner, notificationChannelId, enabled } = input;
    return {
      name: `Deployment ${dseq} closed`,
      userId,
      notificationChannelId,
      enabled,
      type: "CHAIN_EVENT",
      params: {
        dseq,
        type: "DEPLOYMENT_CLOSED"
      },
      conditions: {
        value: [
          {
            field: "action",
            value: "deployment-closed",
            operator: "eq"
          },
          {
            field: "owner",
            value: owner,
            operator: "eq"
          },
          {
            field: "dseq",
            value: dseq,
            operator: "eq"
          }
        ],
        operator: "and"
      },
      summary: `Deployment {{alert.next.params.dseq}} is now closed`,
      description: `Please visit ${this.getConsoleLink(dseq)} to manage your deployment and re-deploy if needed.`
    };
  }

  private getConsoleLink(dseq: string): string {
    const baseUrl = this.configService.getOrThrow("alert.CONSOLE_WEB_URL");
    return `<a href="https://${baseUrl}/deployments/${dseq}?tab=ALERTS">${baseUrl}</a>`;
  }

  async get(dseq: string, ability: MongoAbility): Promise<DeploymentAlertOutput> {
    const alerts = (await this.alertRepository
      .accessibleBy(ability, "read", "DeploymentAlert")
      .findAllDeploymentAlerts({ dseq, includeSuppressed: true })) as RepositoryAlert[];

    const result: DeploymentAlertOutput = {
      dseq,
      alerts: {}
    };

    for (const alert of alerts) {
      if (alert.type === "DEPLOYMENT_BALANCE" && alert.conditions) {
        result.alerts.deploymentBalance = {
          id: alert.id,
          notificationChannelId: alert.notificationChannelId,
          enabled: alert.enabled,
          threshold: alert.conditions.value,
          status: alert.status,
          suppressedBySystem: !!alert.params.suppressedBySystem
        };
      } else if (alert.type === "CHAIN_EVENT" && alert.params) {
        const params = alert.params as { dseq?: string; type?: string };
        if (params.type === "DEPLOYMENT_CLOSED") {
          result.alerts.deploymentClosed = {
            id: alert.id,
            notificationChannelId: alert.notificationChannelId,
            enabled: alert.enabled,
            status: alert.status,
            suppressedBySystem: !!alert.params.suppressedBySystem
          };
        }
      }
    }

    return result;
  }
}
