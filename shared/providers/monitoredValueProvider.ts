import { MonitoredValueTrackerType, NotificationTemplate } from "../";
import { MonitoredValue } from "../dbSchemas/base";
import { UserAlert, AlertMonitoredValue } from "../dbSchemas/user";
import { Transaction as DbTransaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
// TEST CHANGES
export function getTargetFromConditions(
  tracker: MonitoredValueTrackerType,
  conditions: {
    [key: string]: {
      operator: string;
      value: string;
    };
  }
): string {
  switch (tracker) {
    case "AddressBalanceMonitor":
      return conditions["address"].value;
    case "DeploymentBalanceMonitor":
      return `${conditions["owner"].value}/${conditions["dseq"].value}`;
    default:
      throw new Error(`Unknown tracker type: ${tracker}`);
  }
}

export function getConditionsFromTarget(tracker: MonitoredValueTrackerType, target: string): { key: string; value: string }[] {
  switch (tracker) {
    case "AddressBalanceMonitor":
      return [
        {
          key: "address",
          value: target
        }
      ];
    case "DeploymentBalanceMonitor":
      const [owner, dseq] = target.split("/");
      return [
        { key: "owner", value: owner },
        { key: "dseq", value: dseq }
      ];
    default:
      throw new Error(`Unknown tracker type: ${tracker}`);
  }
}

export async function createMonitoredValueIfNeeded(db: Sequelize, tracker: string, target: string) {
  const monitoredValueRepository = db.getRepository(MonitoredValue);
  await monitoredValueRepository.findOrCreate({
    defaults: { tracker: tracker, target: target },
    where: {
      tracker: tracker,
      target: target
    }
  });
}

export async function deleteMonitoredValueIfNoLongerNeeded(
  db: Sequelize,
  chain: string,
  notifTemplate: NotificationTemplate,
  target: string,
  userDbTransaction: DbTransaction | undefined = undefined
) {
  const otherAlert = await AlertMonitoredValue.findOne({
    where: {
      target: target
    },
    include: [
      {
        model: UserAlert,
        required: true,
        where: {
          chain: chain,
          type: notifTemplate.code,
          isDeleted: false,
          enabled: true
        }
      }
    ],
    transaction: userDbTransaction
  });

  if (!otherAlert) {
    const monitoredValueRepository = db.getRepository(MonitoredValue);
    await monitoredValueRepository.destroy({
      where: {
        tracker: notifTemplate.tracker,
        target: target
      }
    });
  }
}
