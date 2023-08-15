import { PropertyTypes } from "../propertyTypes";

interface ConditionTemplate {
  key: string;
  arg?: string;
  value?: string;
}

interface TriggerTemplate {
  type: string;
  conditions?: ConditionTemplate[];
}

export interface NotificationTemplateArg {
  code: string;
  label: string;
  type: PropertyTypes;
  required?: boolean;
  operators?: string[];
}

export interface NotificationTemplate {
  code: string;
  name: string;
  description?: string;
  args?: NotificationTemplateArg[];
  triggers?: TriggerTemplate[];
  tracker?: MonitoredValueTrackerType;
  showNoConditionWarning?: boolean;
}

import { cosmosAlertTemplates } from "./cosmos";
import { akashAlertTemplates } from "./akash";
import { stargazeAlertTemplates } from "./stargaze";

export const alertTemplatesByChain = {
  akash: akashAlertTemplates,
  stargaze: stargazeAlertTemplates
};

export const allAlertTemplates = [...cosmosAlertTemplates, ...akashAlertTemplates, ...stargazeAlertTemplates];
export type MonitoredValueTrackerType = "AddressBalanceMonitor" | "DeploymentBalanceMonitor";
