import { generateMock } from '@anatine/zod-mock';
import { Test, type TestingModule } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { MsgCloseDeploymentDto } from '@src/alert/dto/msg-close-deployment.dto';
import type { AlertOutput } from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { RawAlertRepository } from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { AlertSenderService } from '@src/alert/services/alert-sender/alert-sender.service';
import { TemplateService } from '@src/alert/services/template/template.service';
import { LoggerService } from '@src/common/services/logger/logger.service';
import { ConditionsMatcherService } from '../conditions-matcher/conditions-matcher.service';
import { RawAlertsService } from './raw-alerts.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateRawAlert } from '@test/seeders/raw-alert.seeder';

describe(RawAlertsService.name, () => {
  describe('alertFor', () => {
    it('should send notification when event conditions match', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertSenderService,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
      });

      const alerts: AlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      conditionsMatcher.isMatching.mockReturnValue(true);

      await service.alertFor(event);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.eventConditions,
        event,
      );
      expect(alertSenderService.send).toHaveBeenCalledWith({
        alert,
        vars: event,
      });
    });

    it('should not send notification when event conditions do not match', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertSenderService,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'different.message.type',
          operator: 'eq',
        },
      });

      const alerts: AlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      conditionsMatcher.isMatching.mockReturnValue(false);

      await service.alertFor(event);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.eventConditions,
        event,
      );
      expect(alertSenderService.send).not.toHaveBeenCalled();
    });

    it('should log error if alert processing fails', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertSenderService,
        loggerService,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
      });

      const alerts: AlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      const error = new Error('test');
      conditionsMatcher.isMatching.mockImplementation(() => {
        throw error;
      });

      await service.alertFor(event);

      expect(alertSenderService.send).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        alert,
        triggerEvent: event,
        error,
      });
    });

    it('should log error if alert repository call fails and reject', async () => {
      const { service, alertRepository, loggerService, alertSenderService } =
        await setup();

      const error = new Error('test');
      alertRepository.paginate.mockRejectedValue(error);

      const event = generateMock(MsgCloseDeploymentDto.schema);

      await expect(service.alertFor(event)).rejects.toBe(error);

      expect(alertSenderService.send).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        error,
      });
    });

    it('should process multiple alerts in parallel', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertSenderService,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert1 = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
      });

      const alert2 = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
      });

      const alerts: AlertOutput[] = [alert1, alert2];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      conditionsMatcher.isMatching.mockReturnValue(true);

      await service.alertFor(event);

      expect(alertSenderService.send).toHaveBeenCalledTimes(2);
      expect(alertSenderService.send).toHaveBeenCalledWith({
        alert: alert1,
        vars: event,
      });
      expect(alertSenderService.send).toHaveBeenCalledWith({
        alert: alert2,
        vars: event,
      });
    });

    it('should correctly handle complex condition matching', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertSenderService,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);
      const owner = event.value.id.owner;

      const alert = generateRawAlert({
        eventConditions: {
          operator: 'and',
          value: [
            {
              field: 'type',
              value: 'akash.deployment.v1beta3.MsgCloseDeployment',
              operator: 'eq',
            },
            {
              field: 'value.id.owner',
              value: owner,
              operator: 'eq',
            },
          ],
        },
      });

      const alerts: AlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      conditionsMatcher.isMatching.mockReturnValue(true);

      await service.alertFor(event);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.eventConditions,
        event,
      );
      expect(alertSenderService.send).toHaveBeenCalledWith({
        alert,
        vars: event,
      });
    });
  });

  async function setup(): Promise<{
    service: RawAlertsService;
    loggerService: MockProxy<LoggerService>;
    alertRepository: MockProxy<RawAlertRepository>;
    conditionsMatcher: MockProxy<ConditionsMatcherService>;
    alertSenderService: MockProxy<AlertSenderService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawAlertsService,
        TemplateService,
        MockProvider(RawAlertRepository),
        MockProvider(ConditionsMatcherService),
        MockProvider(LoggerService),
        MockProvider(AlertSenderService),
      ],
    }).compile();

    return {
      service: module.get<RawAlertsService>(RawAlertsService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      alertRepository:
        module.get<MockProxy<RawAlertRepository>>(RawAlertRepository),
      conditionsMatcher: module.get<MockProxy<ConditionsMatcherService>>(
        ConditionsMatcherService,
      ),
      alertSenderService:
        module.get<MockProxy<AlertSenderService>>(AlertSenderService),
    };
  }
});
