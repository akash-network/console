import { faker } from '@faker-js/faker';
import { Test, type TestingModule } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';
import { Err, Ok } from 'ts-results';

import type { DeploymentBalanceAlertOutput } from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { DeploymentBalanceAlertRepository } from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { AlertSenderService } from '@src/alert/services/alert-sender/alert-sender.service';
import { TemplateService } from '@src/alert/services/template/template.service';
import { LoggerService } from '@src/common/services/logger/logger.service';
import { RichError } from '@src/lib/rich-error/rich-error';
import { ConditionsMatcherService } from '../conditions-matcher/conditions-matcher.service';
import { DeploymentService } from '../deployment/deployment.service';
import { DeploymentBalanceAlertsService } from './deployment-balance-alerts.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { mockAkashAddress } from '@test/seeders/akash-address.seeder';
import { generateDeploymentBalanceAlert } from '@test/seeders/deployment-balance-alert.seeder';

describe(DeploymentBalanceAlertsService.name, () => {
  describe('alertFor', () => {
    it('should alert for a given block and mark it as firing', async () => {
      const {
        service,
        alertRepository,
        deploymentService,
        alertSenderService,
      } = await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        owner,
        dseq,
        conditions: { field: 'balance', value: 10000000, operator: 'lt' },
        minBlockHeight: 1000,
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginate.mockImplementation(async (options) => {
        options.callback(alerts);
      });
      const balance = { balance: 9000000 };
      deploymentService.getDeploymentBalance.mockResolvedValue(Ok(balance));

      await service.alertFor({ height: 1000 });

      expect(alertSenderService.send).toHaveBeenCalledWith({
        alert,
        vars: balance,
        summaryPrefix: 'FIRING',
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: 'firing',
      });
    });

    it('should recover an alert for a given block and mark it as normal', async () => {
      const {
        service,
        alertRepository,
        deploymentService,
        alertSenderService,
      } = await setup();
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

      const balance = { balance: 11000000 };
      deploymentService.getDeploymentBalance.mockResolvedValue(Ok(balance));

      await service.alertFor({ height: 1000 });

      expect(alertSenderService.send).toHaveBeenCalledWith({
        alert,
        vars: balance,
        summaryPrefix: 'RECOVERED',
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: 'normal',
      });
    });

    it('should not proceed with an already firing alert', async () => {
      const {
        service,
        alertRepository,
        deploymentService,
        alertSenderService,
      } = await setup();
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

      const balance = { balance: 9000000 };
      deploymentService.getDeploymentBalance.mockResolvedValue(Ok(balance));

      await service.alertFor({ height: 1000 });

      expect(alertSenderService.send).not.toHaveBeenCalled();
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
      });
    });

    it('should disable an alert if the deployment balance is null', async () => {
      const {
        service,
        alertRepository,
        deploymentService,
        alertSenderService,
      } = await setup();
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

      deploymentService.getDeploymentBalance.mockResolvedValue(
        Err(new RichError('Deployment closed', 'DEPLOYMENT_CLOSED')),
      );

      await service.alertFor({ height: 1000 });

      expect(alertSenderService.send).toHaveBeenCalledWith({
        alert: {
          ...alert,
          description: `Alert is suspended as deployment is now in closed state.\n${alert.description}`,
        },
        vars: {},
        summaryPrefix: 'SUSPENDED',
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        enabled: false,
      });
    });

    it('should log error if alert repository call fails and reject', async () => {
      const { service, alertRepository, loggerService, alertSenderService } =
        await setup();
      const error = new Error('test');
      alertRepository.paginate.mockRejectedValue(error);
      const block = { height: 1000 };

      await expect(service.alertFor(block)).rejects.toBe(error);

      expect(alertSenderService.send).not.toHaveBeenCalled();
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
        alertSenderService,
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

      expect(alertSenderService.send).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'ALERT_FAILURE',
        alert,
        error,
      });
    });
  });

  async function setup(): Promise<{
    service: DeploymentBalanceAlertsService;
    loggerService: MockProxy<LoggerService>;
    alertRepository: MockProxy<DeploymentBalanceAlertRepository>;
    conditionsMatcherService: ConditionsMatcherService;
    alertSenderService: MockProxy<AlertSenderService>;
    deploymentService: MockProxy<DeploymentService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentBalanceAlertsService,
        ConditionsMatcherService,
        TemplateService,
        MockProvider(DeploymentBalanceAlertRepository),
        MockProvider(AlertSenderService),
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
      alertSenderService:
        module.get<MockProxy<AlertSenderService>>(AlertSenderService),
      deploymentService:
        module.get<MockProxy<DeploymentService>>(DeploymentService),
    };
  }
});
