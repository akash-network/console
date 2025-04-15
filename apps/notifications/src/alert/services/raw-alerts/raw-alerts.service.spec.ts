import { generateMock } from '@anatine/zod-mock';
import { Test, type TestingModule } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { MsgCloseDeploymentDto } from '@src/alert/dto/msg-close-deployment.dto';
import type { AlertOutput } from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { RawAlertRepository } from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { BrokerService } from '@src/broker';
import { LoggerService } from '@src/common/services/logger.service';
import { ConditionsMatcherService } from '../conditions-matcher/conditions-matcher.service';
import { RawAlertsService } from './raw-alerts.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateRawAlert } from '@test/seeders/raw-alert.seeder';

describe(RawAlertsService.name, () => {
  describe('alertFor', () => {
    it('should send notification when event conditions match', async () => {
      const { service, alertRepository, conditionsMatcher, brokerService } =
        await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);

      const alert = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
        template:
          'Deployment ${value.id.dseq.low} was closed by ${value.id.owner}',
      });

      const alerts: AlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      conditionsMatcher.isMatching.mockReturnValue(true);

      await service.alertFor(mockEvent);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.eventConditions,
        mockEvent,
      );
      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        {
          message: `Deployment ${mockEvent.value.id.dseq.low} was closed by ${mockEvent.value.id.owner}`,
        },
      );
    });

    it('should not send notification when event conditions do not match', async () => {
      const { service, alertRepository, conditionsMatcher, brokerService } =
        await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);

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

      await service.alertFor(mockEvent);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.eventConditions,
        mockEvent,
      );
      expect(brokerService.publish).not.toHaveBeenCalled();
    });

    it('should log error if alert processing fails', async () => {
      const {
        service,
        alertRepository,
        conditionsMatcher,
        brokerService,
        loggerService,
      } = await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);

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

      await service.alertFor(mockEvent);

      expect(brokerService.publish).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        alert,
        triggerEvent: mockEvent,
        error,
      });
    });

    it('should log error if alert repository call fails and reject', async () => {
      const { service, alertRepository, loggerService, brokerService } =
        await setup();

      const error = new Error('test');
      alertRepository.paginate.mockRejectedValue(error);

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);

      await expect(service.alertFor(mockEvent)).rejects.toBe(error);

      expect(brokerService.publish).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        error,
      });
    });

    it('should process multiple alerts in parallel', async () => {
      const { service, alertRepository, conditionsMatcher, brokerService } =
        await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);

      const alert1 = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
        template: 'Alert 1: DSEQ ${value.id.dseq.low}',
      });

      const alert2 = generateRawAlert({
        eventConditions: {
          field: 'type',
          value: 'akash.deployment.v1beta3.MsgCloseDeployment',
          operator: 'eq',
        },
        template: 'Alert 2: Owner ${value.id.owner}',
      });

      const alerts: AlertOutput[] = [alert1, alert2];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      conditionsMatcher.isMatching.mockReturnValue(true);

      await service.alertFor(mockEvent);

      expect(brokerService.publish).toHaveBeenCalledTimes(2);
      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        { message: `Alert 1: DSEQ ${mockEvent.value.id.dseq.low}` },
      );
      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        { message: `Alert 2: Owner ${mockEvent.value.id.owner}` },
      );
    });

    it('should correctly handle complex condition matching', async () => {
      const { service, alertRepository, conditionsMatcher, brokerService } =
        await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);
      const owner = mockEvent.value.id.owner;

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
        template: 'Deployment ${value.id.dseq.low} closed by ${value.id.owner}',
      });

      const alerts: AlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      conditionsMatcher.isMatching.mockReturnValue(true);

      await service.alertFor(mockEvent);

      expect(conditionsMatcher.isMatching).toHaveBeenCalledWith(
        alert.eventConditions,
        mockEvent,
      );
      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        {
          message: `Deployment ${mockEvent.value.id.dseq.low} closed by ${owner}`,
        },
      );
    });
  });

  async function setup(): Promise<{
    service: RawAlertsService;
    loggerService: MockProxy<LoggerService>;
    alertRepository: MockProxy<RawAlertRepository>;
    conditionsMatcher: MockProxy<ConditionsMatcherService>;
    brokerService: MockProxy<BrokerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawAlertsService,
        MockProvider(RawAlertRepository),
        MockProvider(ConditionsMatcherService),
        MockProvider(BrokerService),
        MockProvider(LoggerService),
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
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService),
    };
  }
});
