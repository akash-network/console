import { BalanceHttpService, type Denom } from "@akashnetwork/http-sdk";
import { Test, type TestingModule } from "@nestjs/testing";
import { describe, expect, it, type Mock, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertOutput, WalletBalanceAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertMessageService } from "@src/modules/alert/services/alert-message/alert-message.service";
import { TemplateService } from "@src/modules/alert/services/template/template.service";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";
import { ConditionsMatcherService } from "../conditions-matcher/conditions-matcher.service";
import { WalletBalanceAlertsService } from "./wallet-balance-alerts.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateAlertMessage } from "@test/seeders/alert-message.seeder";
import { generateWalletBalanceAlert } from "@test/seeders/wallet-balance-alert.seeder";

describe(WalletBalanceAlertsService.name, () => {
  describe("alertFor", () => {
    it("should alert for a given block and mark it as triggered", async () => {
      const { service, alertRepository, balanceHttpService, alertMessageService, onMessage } = await setup();
      const owner = mockAkashAddress();
      const denom = "uakt";
      const alert = generateWalletBalanceAlert({
        params: {
          owner,
          denom
        },
        conditions: { field: "balance", value: 10000000, operator: "lt" },
        minBlockHeight: 1000
      });
      const alerts: WalletBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      alertRepository.updateById.mockImplementation(
        async (id, update) =>
          ({
            ...alert,
            ...update
          }) as AlertOutput
      );
      const balance = { amount: 9000000, denom: "uakt" as Denom };
      balanceHttpService.getBalance.mockResolvedValue(balance);
      const alertMessage = generateAlertMessage({
        notificationChannelId: alert.notificationChannelId
      });
      alertMessageService.getMessage.mockReturnValue(alertMessage.payload);

      await service.alertFor({ height: 1000 }, onMessage);

      expect(balanceHttpService.getBalance).toHaveBeenCalledWith(owner, denom);
      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert.summary,
        description: alert.description,
        vars: {
          alert: {
            prev: expect.objectContaining({ id: alert.id }),
            next: expect.objectContaining({ id: alert.id })
          },
          data: balance
        }
      });
      expect(onMessage).toHaveBeenCalledWith({
        notificationChannelId: alert.notificationChannelId,
        payload: {
          ...alertMessage.payload,
          feedEntry: { type: "wallet_balance_alert", alertId: alert.id, dedupeKey: `wallet_balance_alert.${alert.id}.1000` }
        }
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: "TRIGGERED"
      });
    });

    it("should recover an alert for a given block and mark it as OK", async () => {
      const { service, alertRepository, balanceHttpService, alertMessageService, onMessage } = await setup();
      const owner = mockAkashAddress();
      const denom = "uakt";
      const alert = generateWalletBalanceAlert({
        params: {
          owner,
          denom
        },
        conditions: { field: "balance", value: 10000000, operator: "lt" },
        minBlockHeight: 1000,
        status: "TRIGGERED"
      });
      const alerts: WalletBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      alertRepository.updateById.mockImplementation(
        async (id, update) =>
          ({
            ...alert,
            ...update
          }) as AlertOutput
      );

      const balance = { amount: 11000000, denom: "uakt" as Denom };
      balanceHttpService.getBalance.mockResolvedValue(balance);
      const alertMessage = generateAlertMessage({
        notificationChannelId: alert.notificationChannelId
      });
      alertMessageService.getMessage.mockReturnValue(alertMessage.payload);

      await service.alertFor({ height: 1000 }, onMessage);

      expect(balanceHttpService.getBalance).toHaveBeenCalledWith(owner, denom);
      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert.summary,
        description: alert.description,
        vars: {
          alert: {
            prev: expect.objectContaining({ id: alert.id }),
            next: expect.objectContaining({ id: alert.id })
          },
          data: balance
        }
      });
      expect(onMessage).toHaveBeenCalledWith({
        notificationChannelId: alert.notificationChannelId,
        payload: {
          ...alertMessage.payload,
          feedEntry: { type: "wallet_balance_alert", alertId: alert.id, dedupeKey: `wallet_balance_alert.${alert.id}.1000` }
        }
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: "OK"
      });
    });

    it("should not proceed with an already triggered alert", async () => {
      const { service, alertRepository, balanceHttpService, alertMessageService } = await setup();
      const owner = mockAkashAddress();
      const denom = "uakt";
      const alert = generateWalletBalanceAlert({
        params: {
          owner,
          denom
        },
        conditions: { field: "balance", value: 10000000, operator: "lt" },
        minBlockHeight: 1000,
        status: "TRIGGERED"
      });
      const alerts: WalletBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      alertRepository.updateById.mockImplementation(
        async (id, update) =>
          ({
            ...alert,
            ...update
          }) as AlertOutput
      );

      const balance = { amount: 9000000, denom: "uakt" as Denom };
      balanceHttpService.getBalance.mockResolvedValue(balance);
      const onMessage = vi.fn();

      await service.alertFor({ height: 1000 }, onMessage);

      expect(balanceHttpService.getBalance).toHaveBeenCalledWith(owner, denom);
      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010
      });
    });

    it("should log error and return if wallet balance is null", async () => {
      const { service, alertRepository, balanceHttpService, alertMessageService, loggerService, onMessage } = await setup();
      const owner = mockAkashAddress();
      const denom = "uakt";
      const alert = generateWalletBalanceAlert({
        params: {
          owner,
          denom
        }
      });
      const alerts: WalletBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });

      balanceHttpService.getBalance.mockResolvedValue(undefined);

      await service.alertFor({ height: 1000 }, onMessage);

      expect(balanceHttpService.getBalance).toHaveBeenCalledWith(owner, denom);
      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(alertRepository.updateById).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "ALERT_FAILURE",
        alert,
        error: expect.any(Error)
      });
    });

    it("should log error if alert repository call fails and reject", async () => {
      const { service, alertRepository, loggerService, alertMessageService } = await setup();
      const error = new Error("test");
      alertRepository.paginateAll.mockRejectedValue(error);
      const block = { height: 1000 };
      const onMessage = vi.fn();

      await expect(service.alertFor(block, onMessage)).rejects.toBe(error);

      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(alertRepository.updateById).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "ALERT_FAILURE",
        block: block.height,
        error
      });
    });

    it("should log a single alert error", async () => {
      const { service, alertRepository, balanceHttpService, alertMessageService, loggerService } = await setup();
      const alert = generateWalletBalanceAlert({});
      const alerts: WalletBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      const error = new Error("test");
      balanceHttpService.getBalance.mockRejectedValue(error);
      const block = { height: 1000 };
      const onMessage = vi.fn();
      await service.alertFor(block, onMessage);

      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "ALERT_FAILURE",
        alert,
        error
      });
    });

    it("gives a block evaluated twice the same feed entry, so the feed shows its firing once", async () => {
      const { service, alertRepository, balanceHttpService, alertMessageService, onMessage } = await setup();
      const alert = generateWalletBalanceAlert({ conditions: { field: "balance", value: 10_000_000, operator: "lt" }, status: "OK" });
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback([alert] as AlertOutput[]);
      });
      alertRepository.updateById.mockImplementation(async (id, update) => ({ ...alert, ...update }) as AlertOutput);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 9_000_000, denom: "uakt" });
      alertMessageService.getMessage.mockReturnValue(generateAlertMessage({}).payload);

      await service.alertFor({ height: 2000 }, onMessage);
      await service.alertFor({ height: 2000 }, onMessage);

      expect(feedEntriesOf(onMessage)).toEqual([
        { type: "wallet_balance_alert", alertId: alert.id, dedupeKey: `wallet_balance_alert.${alert.id}.2000` },
        { type: "wallet_balance_alert", alertId: alert.id, dedupeKey: `wallet_balance_alert.${alert.id}.2000` }
      ]);
    });

    it("gives every later firing of the alert its own feed entry, including a second drop below the threshold", async () => {
      const { service, alertRepository, balanceHttpService, alertMessageService, onMessage } = await setup();
      let storedAlert: WalletBalanceAlertOutput = generateWalletBalanceAlert({ conditions: { field: "balance", value: 10_000_000, operator: "lt" }, status: "OK" });
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback([storedAlert] as AlertOutput[]);
      });
      alertRepository.updateById.mockImplementation(async (id, update) => {
        storedAlert = { ...storedAlert, ...update } as WalletBalanceAlertOutput;
        return storedAlert as AlertOutput;
      });
      balanceHttpService.getBalance
        .mockResolvedValueOnce({ amount: 9_000_000, denom: "uakt" })
        .mockResolvedValueOnce({ amount: 11_000_000, denom: "uakt" })
        .mockResolvedValueOnce({ amount: 8_000_000, denom: "uakt" });
      alertMessageService.getMessage.mockReturnValue(generateAlertMessage({}).payload);

      await service.alertFor({ height: 3000 }, onMessage);
      await service.alertFor({ height: 3010 }, onMessage);
      await service.alertFor({ height: 3020 }, onMessage);

      expect(feedEntriesOf(onMessage).map(feedEntry => feedEntry?.dedupeKey)).toEqual([
        `wallet_balance_alert.${storedAlert.id}.3000`,
        `wallet_balance_alert.${storedAlert.id}.3010`,
        `wallet_balance_alert.${storedAlert.id}.3020`
      ]);
    });
  });

  function feedEntriesOf(onMessage: Mock<MessageCallback>) {
    return onMessage.mock.calls.map(([message]) => message.payload.feedEntry);
  }

  async function setup(): Promise<{
    service: WalletBalanceAlertsService;
    loggerService: MockProxy<LoggerService>;
    alertRepository: MockProxy<AlertRepository>;
    conditionsMatcherService: ConditionsMatcherService;
    alertMessageService: MockProxy<AlertMessageService>;
    balanceHttpService: MockProxy<BalanceHttpService>;
    onMessage: Mock<MessageCallback>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletBalanceAlertsService,
        ConditionsMatcherService,
        TemplateService,
        MockProvider(AlertRepository),
        MockProvider(AlertMessageService),
        MockProvider(BalanceHttpService),
        MockProvider(LoggerService)
      ]
    }).compile();
    const onMessage = vi.fn<MessageCallback>();

    return {
      service: module.get<WalletBalanceAlertsService>(WalletBalanceAlertsService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      conditionsMatcherService: module.get<ConditionsMatcherService>(ConditionsMatcherService),
      alertMessageService: module.get<MockProxy<AlertMessageService>>(AlertMessageService),
      balanceHttpService: module.get<MockProxy<BalanceHttpService>>(BalanceHttpService),
      onMessage
    };
  }
});
