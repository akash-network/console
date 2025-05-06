import { generateMock } from '@anatine/zod-mock';
import { Test, type TestingModule } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { LoggerService } from '@src/common/services/logger/logger.service';
import { MsgCloseDeploymentDto } from '@src/modules/alert/dto/msg-close-deployment.dto';
import type { AlertOutput } from '@src/modules/alert/repositories/raw-alert/raw-alert.repository';
import { RawAlertRepository } from '@src/modules/alert/repositories/raw-alert/raw-alert.repository';
import { AlertMessageService } from '@src/modules/alert/services/alert-message/alert-message.service';
import { TemplateService } from '@src/modules/alert/services/template/template.service';
import { ConditionsMatcherService } from '../conditions-matcher/conditions-matcher.service';
import { RawAlertsService } from './raw-alerts.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateAlertMessage } from '@test/seeders/alert-message.seeder';
import { generateRawAlert } from '@test/seeders/raw-alert.seeder';

describe(RawAlertsService.name, () => {
  describe('alertFor', () => {
    it('should send notification when event conditions match', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertMessageService,
        onMessage,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert = generateRawAlert({
        conditions: {
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
      const alertMessage = generateAlertMessage({
        contactPointId: alert.contactPointId,
      });
      alertMessageService.getMessage.mockReturnValue(alertMessage.payload);

      await service.alertFor(event, onMessage);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.conditions,
        event,
      );
      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert.summary,
        description: alert.description,
        vars: event,
      });
      expect(onMessage).toHaveBeenCalledWith(alertMessage);
    });

    it('should not send notification when event conditions do not match', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertMessageService,
        onMessage,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert = generateRawAlert({
        conditions: {
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

      await service.alertFor(event, onMessage);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.conditions,
        event,
      );
      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it('should log error if alert processing fails', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertMessageService,
        loggerService,
        onMessage,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert = generateRawAlert({
        conditions: {
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

      await service.alertFor(event, onMessage);

      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        alert,
        triggerEvent: event,
        error,
      });
    });

    it('should log error if alert repository call fails and reject', async () => {
      const {
        service,
        alertRepository,
        loggerService,
        alertMessageService,
        onMessage,
      } = await setup();

      const error = new Error('test');
      alertRepository.paginate.mockRejectedValue(error);

      const event = generateMock(MsgCloseDeploymentDto.schema);

      await expect(service.alertFor(event, onMessage)).rejects.toBe(error);

      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
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
        alertMessageService,
        onMessage,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);

      const alert1 = generateRawAlert({
        conditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
      });

      const alert2 = generateRawAlert({
        conditions: {
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
      const alertMessage1 = generateAlertMessage({
        contactPointId: alert1.contactPointId,
      });
      const alertMessage2 = generateAlertMessage({
        contactPointId: alert2.contactPointId,
      });
      alertMessageService.getMessage
        .mockReturnValueOnce(alertMessage1.payload)
        .mockReturnValueOnce(alertMessage2.payload);

      await service.alertFor(event, onMessage);

      expect(alertMessageService.getMessage).toHaveBeenCalledTimes(2);
      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert1.summary,
        description: alert1.description,
        vars: event,
      });
      expect(onMessage).toHaveBeenCalledWith(alertMessage1);
      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert2.summary,
        description: alert2.description,
        vars: event,
      });
      expect(onMessage).toHaveBeenCalledWith(alertMessage2);
    });

    it('should correctly handle complex condition matching', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        alertMessageService,
        onMessage,
      } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);
      const owner = event.value.id.owner;

      const alert = generateRawAlert({
        conditions: {
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
      const alertMessage = generateAlertMessage({
        contactPointId: alert.contactPointId,
      });
      alertMessageService.getMessage.mockReturnValue(alertMessage.payload);

      await service.alertFor(event, onMessage);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.conditions,
        event,
      );
      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert.summary,
        description: alert.description,
        vars: event,
      });
      expect(onMessage).toHaveBeenCalledWith(alertMessage);
    });
  });

  async function setup(): Promise<{
    service: RawAlertsService;
    loggerService: MockProxy<LoggerService>;
    alertRepository: MockProxy<RawAlertRepository>;
    conditionsMatcher: MockProxy<ConditionsMatcherService>;
    alertMessageService: MockProxy<AlertMessageService>;
    onMessage: jest.Mock;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawAlertsService,
        TemplateService,
        MockProvider(RawAlertRepository),
        MockProvider(ConditionsMatcherService),
        MockProvider(LoggerService),
        MockProvider(AlertMessageService),
      ],
    }).compile();
    const onMessage = jest.fn();

    return {
      service: module.get<RawAlertsService>(RawAlertsService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      alertRepository:
        module.get<MockProxy<RawAlertRepository>>(RawAlertRepository),
      conditionsMatcher: module.get<MockProxy<ConditionsMatcherService>>(
        ConditionsMatcherService,
      ),
      alertMessageService:
        module.get<MockProxy<AlertMessageService>>(AlertMessageService),
      onMessage,
    };
  }
});
