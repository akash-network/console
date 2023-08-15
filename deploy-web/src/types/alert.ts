export interface IUserAlert {
  id: string;
  name: string;
  type: string;
  chain: string;
  eventCount: number;
  enabled: boolean;
  msgType: string;
  createdOn: string;
}

export interface IUserEditAlert extends IUserAlert {
  userId: string;
  chain: string;
  isRecurring: boolean;
  cooldown: string;
  note: string;
  channels: string;
  webhookUrl: string;
  alertTriggers: IAlertTrigger[];
}

export interface IAlertEvent {
  id: string;
  eventDate: string;
  txHash?: string;
  height?: number;
}

export interface IAlertTrigger {
  id: string;
  alertId: string;
  msgType: string;
  alertTriggerConditions: IAlertTriggerCondition[];
}

export interface IAlertTriggerCondition {
  id: string;
  alertTriggerId: string;
  key: string;
  value: string;
  operator: string;
  unit?: string;
}
