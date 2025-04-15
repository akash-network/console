import { faker } from '@faker-js/faker';
import { Test, type TestingModule } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import type { DeploymentBalanceAlertOutput } from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { DeploymentBalanceAlertRepository } from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { BrokerService } from '@src/broker';
import { LoggerService } from '@src/common/services/logger.service';
import { ConditionsMatcherService } from '../conditions-matcher/conditions-matcher.service';
import { DeploymentService } from '../deployment/deployment.service';
import { DeploymentBalanceAlertsService } from './deployment-balance-alerts.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { mockAkashAddress } from '@test/seeders/akash-address.seeder';
import { generateDeploymentBalanceAlert } from '@test/seeders/deployment-balance-alert.seeder';

describe(DeploymentBalanceAlertsService.name, () => {
  describe('alertFor', () => {
    it('should alert for a given block and mark it as firing', async () => {
      const { service, alertRepository, deploymentService, brokerService } =
        await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        owner,
        dseq,
        conditions: { field: 'balance', value: 10000000, operator: 'lt' },
        template: 'Deployment balance is low ${balance}',
        minBlockHeight: 1000,
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      deploymentService.getDeploymentBalance.mockResolvedValue({
        balance: 9000000,
      });

      await service.alertFor({ height: 1000 });

      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        { message: 'FIRING: Deployment balance is low 9000000' },
      );
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: 'firing',
      });
    });

    it('should recover an alert for a given block and mark it as normal', async () => {
      const { service, alertRepository, deploymentService, brokerService } =
        await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        owner,
        dseq,
        conditions: { field: 'balance', value: 10000000, operator: 'lt' },
        template: 'Deployment balance is low ${balance}',
        minBlockHeight: 1000,
        status: 'firing',
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      deploymentService.getDeploymentBalance.mockResolvedValue({
        balance: 11000000,
      });

      await service.alertFor({ height: 1000 });

      expect(brokerService.publish).toHaveBeenCalledWith(
        'notification.v1.send',
        { message: 'RECOVERED: Deployment balance is low 11000000' },
      );
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: 'normal',
      });
    });

    it('should not proceed with an already firing alert', async () => {
      const { service, alertRepository, deploymentService, brokerService } =
        await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        owner,
        dseq,
        conditions: { field: 'balance', value: 10000000, operator: 'lt' },
        minBlockHeight: 1000,
        status: 'firing',
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      deploymentService.getDeploymentBalance.mockResolvedValue({
        balance: 9000000,
      });

      await service.alertFor({ height: 1000 });

      expect(brokerService.publish).not.toHaveBeenCalled();
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
      });
    });

    it('should disable an alert if the deployment balance is null', async () => {
      const { service, alertRepository, deploymentService, brokerService } =
        await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        owner,
        dseq,
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });

      deploymentService.getDeploymentBalance.mockResolvedValue(null);

      await service.alertFor({ height: 1000 });

      expect(brokerService.publish).not.toHaveBeenCalled();
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        enabled: false,
      });
    });

    it('should log error if alert repository call fails and reject', async () => {
      const { service, alertRepository, loggerService, brokerService } =
        await setup();
      const error = new Error('test');
      alertRepository.paginate.mockRejectedValue(error);
      const block = { height: 1000 };

      await expect(service.alertFor(block)).rejects.toBe(error);

      expect(brokerService.publish).not.toHaveBeenCalled();
      expect(alertRepository.updateById).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        block: block.height,
        error,
      });
    });

    it('should log a single alert error', async () => {
      const {
        service,
        alertRepository,
        deploymentService,
        brokerService,
        loggerService,
      } = await setup();
      const alert = generateDeploymentBalanceAlert({});
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });
      const error = new Error('test');
      deploymentService.getDeploymentBalance.mockRejectedValue(error);
      const block = { height: 1000 };
      await service.alertFor(block);

      expect(brokerService.publish).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        alert,
        block: block.height,
        error,
      });
    });
  });

  async function setup(): Promise<{
    service: DeploymentBalanceAlertsService;
    loggerService: MockProxy<LoggerService>;
    alertRepository: MockProxy<DeploymentBalanceAlertRepository>;
    conditionsMatcherService: ConditionsMatcherService;
    brokerService: MockProxy<BrokerService>;
    deploymentService: MockProxy<DeploymentService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentBalanceAlertsService,
        MockProvider(DeploymentBalanceAlertRepository),
        ConditionsMatcherService,
        MockProvider(BrokerService),
        MockProvider(DeploymentService),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      service: module.get<DeploymentBalanceAlertsService>(
        DeploymentBalanceAlertsService,
      ),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      alertRepository: module.get<MockProxy<DeploymentBalanceAlertRepository>>(
        DeploymentBalanceAlertRepository,
      ),
      conditionsMatcherService: module.get<ConditionsMatcherService>(
        ConditionsMatcherService,
      ),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService),
      deploymentService:
        module.get<MockProxy<DeploymentService>>(DeploymentService),
    };
  }
});
