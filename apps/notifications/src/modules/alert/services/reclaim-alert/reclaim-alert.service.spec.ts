import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { faker } from "@faker-js/faker";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import moduleConfig, { type AlertConfig } from "@src/modules/alert/config";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { DeploymentNameClient } from "@src/modules/alert/services/deployment-name-client/deployment-name-client.service";
import { DeploymentReferenceService } from "@src/modules/alert/services/deployment-reference/deployment-reference.service";
import type { ReclaimAlertEvent } from "@src/modules/alert/services/reclaim-alert/reclaim-alert.service";
import { ReclaimAlertService } from "@src/modules/alert/services/reclaim-alert/reclaim-alert.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

describe(ReclaimAlertService.name, () => {
  describe("alertFor", () => {
    it("skips when no deployment-closed alert exists for the owner and dseq", async () => {
      const { service, alertRepository, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(undefined);

      await service.alertFor(generateReclaimEvent(), onMessage);

      expect(alertRepository.claimNotification).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("skips when the deployment-closed alert is disabled (opted out)", async () => {
      const { service, alertRepository, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: false }));

      await service.alertFor(generateReclaimEvent(), onMessage);

      expect(alertRepository.claimNotification).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("skips when the reclaim notification was already claimed", async () => {
      const { service, alertRepository, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true }));
      alertRepository.claimNotification.mockResolvedValue(undefined);

      await service.alertFor(generateReclaimEvent(), onMessage);

      expect(onMessage).not.toHaveBeenCalled();
    });

    it("claims then sends exactly one notification to the alert's channel", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);

      await service.alertFor(generateReclaimEvent({ dseq: "12345" }), onMessage);

      expect(alertRepository.claimNotification).toHaveBeenCalledWith(alert.id, "reclaimNotifiedAt");
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationChannelId: alert.notificationChannelId,
          payload: {
            summary: expect.stringContaining("12345"),
            description: expect.any(String),
            feedEntry: expect.any(Object)
          }
        })
      );
    });

    it("adds the notice to the feed once per claimed alert, linked to the deployment, leaving its email as it was", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);
      const provider = mockAkashAddress();

      await service.alertFor(generateReclaimEvent({ dseq: "12345", provider, deadline: 1749398400 }), onMessage);

      const { summary, description, feedEntry } = onMessage.mock.calls[0][0].payload;
      expect(summary).toBe("Deployment 12345 is being reclaimed by the provider");
      expect(description).toContain(`The provider ${provider} has started reclaiming deployment 12345`);
      expect(feedEntry).toEqual({
        type: "deployment_reclaim_alert",
        alertId: alert.id,
        userId: alert.userId,
        organizationId: null,
        projectId: null,
        dedupeKey: `deployment_reclaim_alert.${alert.id}`,
        dseq: "12345"
      });
    });

    it("files the notice of a team deployment under the user who set its alert, in the alert's organization and project", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true, organizationId: faker.string.uuid(), projectId: faker.string.uuid() });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);

      await service.alertFor(generateReclaimEvent({ dseq: "12345" }), onMessage);

      expect(onMessage.mock.calls[0][0].payload.feedEntry).toMatchObject({
        userId: alert.userId,
        organizationId: alert.organizationId,
        projectId: alert.projectId
      });
    });

    it("gives each claimed alert's notice its own feed entry", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const first = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      const second = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
      alertRepository.claimNotification.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

      await service.alertFor(generateReclaimEvent({ dseq: "12345" }), onMessage);
      await service.alertFor(generateReclaimEvent({ dseq: "67890" }), onMessage);

      const [firstEntry, secondEntry] = onMessage.mock.calls.map(([message]) => message.payload.feedEntry);
      expect(firstEntry).toMatchObject({ alertId: first.id, dseq: "12345" });
      expect(secondEntry).toMatchObject({ alertId: second.id, dseq: "67890" });
      expect(firstEntry.dedupeKey).not.toBe(secondEntry.dedupeKey);
    });

    it("includes the provider, reason, deadline and deep link in the message", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);
      const provider = mockAkashAddress();

      await service.alertFor(
        generateReclaimEvent({ dseq: "12345", provider, reason: LeaseClosedReason.lease_closed_reason_unstable, deadline: 1749398400 }),
        onMessage
      );

      const { description } = onMessage.mock.calls[0][0].payload;
      expect(description).toContain(provider);
      expect(description).toContain("the workload has been unstable");
      expect(description).toContain("2025-06-08");
      expect(description).toContain("/deployments/12345");
    });

    it("names the deployment by its name, escaped in the description, and links to it in the alert's organization", async () => {
      const { service, alertRepository, deploymentNameClient, onMessage, consoleWebUrl } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true, organizationId: faker.string.uuid() });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);
      deploymentNameClient.findName.mockResolvedValue("<b>Tom & Jerry</b>");
      const event = generateReclaimEvent({ dseq: "12345" });

      await service.alertFor(event, onMessage);

      const { summary, description, feedEntry } = onMessage.mock.calls[0][0].payload;
      expect(deploymentNameClient.findName).toHaveBeenCalledWith({
        owner: event.owner,
        dseq: "12345",
        reader: { userId: alert.userId, organizationId: alert.organizationId }
      });
      expect(summary).toBe("Deployment “<b>Tom & Jerry</b>” is being reclaimed by the provider");
      expect(description).toContain(`has started reclaiming deployment “&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;” because`);
      expect(description).toContain(`Please visit <a href="https://${consoleWebUrl}/deployments/12345?org=${alert.organizationId}">${consoleWebUrl}</a>`);
      expect(feedEntry).toMatchObject({ dseq: "12345" });
    });

    it("skips an opted-out alert without looking the deployment up", async () => {
      const { service, alertRepository, deploymentNameClient, onMessage } = await setup();
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(generateGeneralAlert({ type: "CHAIN_EVENT", enabled: false }));

      await service.alertFor(generateReclaimEvent(), onMessage);

      expect(deploymentNameClient.findName).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("shows the deadline in the timezone of the channel the alert emails, naming the zone", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);
      alertRepository.findNotificationChannelTimezone.mockResolvedValue("Asia/Tokyo");

      await service.alertFor(generateReclaimEvent({ deadline: 1749398400 }), onMessage);

      expect(alertRepository.findNotificationChannelTimezone).toHaveBeenCalledWith(alert.notificationChannelId);
      expect(onMessage.mock.calls[0][0].payload.description).toContain("You have until 2025-06-09 01:00 Japan Standard Time (");
    });

    it("shows the deadline in UTC when the channel the alert emails has no timezone", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.claimNotification.mockResolvedValue(alert);
      alertRepository.findNotificationChannelTimezone.mockResolvedValue(null);

      await service.alertFor(generateReclaimEvent({ deadline: 1749398400 }), onMessage);

      expect(onMessage.mock.calls[0][0].payload.description).toContain("You have until 2025-06-08 16:00 UTC (");
    });

    it("leaves the alert unclaimed for a redelivery when the channel's timezone cannot be read", async () => {
      const { service, alertRepository, onMessage } = await setup();
      const alert = generateGeneralAlert({ type: "CHAIN_EVENT", enabled: true });
      alertRepository.findDeploymentClosedAlertByOwnerAndDseq.mockResolvedValue(alert);
      alertRepository.findNotificationChannelTimezone.mockRejectedValue(new Error("connection reset"));

      await expect(service.alertFor(generateReclaimEvent(), onMessage)).rejects.toThrow("connection reset");

      expect(alertRepository.claimNotification).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  function generateReclaimEvent(overrides: Partial<ReclaimAlertEvent> = {}): ReclaimAlertEvent {
    return {
      owner: mockAkashAddress(),
      dseq: "12345",
      provider: mockAkashAddress(),
      reason: LeaseClosedReason.lease_closed_reason_unstable,
      deadline: 1749398400,
      ...overrides
    };
  }

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(moduleConfig)],
      providers: [
        ReclaimAlertService,
        DeploymentReferenceService,
        MockProvider(DeploymentNameClient),
        MockProvider(AlertRepository),
        MockProvider(LoggerService)
      ]
    }).compile();
    const deploymentNameClient = module.get<MockProxy<DeploymentNameClient>>(DeploymentNameClient);
    deploymentNameClient.findName.mockResolvedValue(null);

    return {
      service: module.get<ReclaimAlertService>(ReclaimAlertService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      deploymentNameClient,
      consoleWebUrl: module.get<ConfigService<AlertConfig>>(ConfigService).getOrThrow("alert.CONSOLE_WEB_URL"),
      onMessage: vi.fn()
    };
  }
});
