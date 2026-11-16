import { LeaseClosedReason } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { faker } from "@faker-js/faker";
import type { ConfigService } from "@nestjs/config";
import { addSeconds, subSeconds } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { BrokerService } from "@src/infrastructure/broker";
import type { AlertConfig } from "@src/modules/alert/config";
import type { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { ClosureNoticeRepository } from "@src/modules/alert/repositories/closure-notice/closure-notice.repository";
import type { DeploymentReferenceService } from "@src/modules/alert/services/deployment-reference/deployment-reference.service";
import type { ProviderHostService } from "@src/modules/alert/services/provider-host/provider-host.service";
import { ClosureAlertService } from "./closure-alert.service";
import { toClosureEmail } from "./closure-alert-email";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateClosureNotice } from "@test/seeders/closure-notice.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

const HOLD_SECONDS = 120;
const DIGEST_WINDOW_SECONDS = 3600;

describe(ClosureAlertService.name, () => {
  describe("recordDeploymentClosure", () => {
    it("records the closure under the alert's channel with the deployment's label and link", async () => {
      const { service, closureNoticeRepository, deploymentReferenceService, now } = setup();
      const alert = generateDeploymentClosedAlert({ organizationId: faker.string.uuid(), projectId: faker.string.uuid() });
      const owner = mockAkashAddress();

      await service.recordDeploymentClosure(alert, { owner, dseq: "1001" });

      expect(deploymentReferenceService.referTo).toHaveBeenCalledWith({
        owner,
        dseq: "1001",
        userId: alert.userId,
        organizationId: alert.organizationId,
        tab: "SETTINGS"
      });
      expect(closureNoticeRepository.record).toHaveBeenCalledWith({
        alertId: alert.id,
        notificationChannelId: alert.notificationChannelId,
        userId: alert.userId,
        organizationId: alert.organizationId,
        projectId: alert.projectId,
        owner,
        dseq: "1001",
        deploymentLabel: "“my-app”",
        deploymentLink: "LINK",
        deploymentClosed: true,
        createdAt: now
      });
    });

    it("schedules the channel's flush once the closure has been held, when the channel got no closure email lately", async () => {
      const { service, closureNoticeRepository, brokerService, now } = setup();
      const alert = generateDeploymentClosedAlert();
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: now, lastSentAt: subSeconds(now, DIGEST_WINDOW_SECONDS + 1) });

      await service.recordDeploymentClosure(alert, { owner: mockAkashAddress(), dseq: "1001" });

      expect(closureNoticeRepository.findChannelState).toHaveBeenCalledWith(alert.notificationChannelId);
      expect(brokerService.publish).toHaveBeenCalledWith(
        eventKeyRegistry.closureAlertsDue,
        { notificationChannelId: alert.notificationChannelId },
        { singletonKey: alert.notificationChannelId, startAfter: addSeconds(now, HOLD_SECONDS) }
      );
    });

    it("schedules the channel's flush for the end of its digest window when the channel got a closure email within it", async () => {
      const { service, closureNoticeRepository, brokerService, now } = setup();
      const alert = generateDeploymentClosedAlert();
      const lastSentAt = subSeconds(now, 600);
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: now, lastSentAt });

      await service.recordDeploymentClosure(alert, { owner: mockAkashAddress(), dseq: "1001" });

      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.closureAlertsDue, expect.anything(), {
        singletonKey: alert.notificationChannelId,
        startAfter: addSeconds(lastSentAt, DIGEST_WINDOW_SECONDS)
      });
    });

    it("schedules nothing when the channel has no pending closure", async () => {
      const { service, closureNoticeRepository, brokerService } = setup();
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: null, lastSentAt: null });

      await service.recordDeploymentClosure(generateDeploymentClosedAlert(), { owner: mockAkashAddress(), dseq: "1001" });

      expect(brokerService.publish).not.toHaveBeenCalled();
    });
  });

  describe("recordLeaseClosure", () => {
    it("claims the alert's lease notification and records the lease's provider and reason in the same transaction", async () => {
      const { service, alertRepository, closureNoticeRepository, providerHostService, brokerService, tx, now } = setup();
      const alert = generateDeploymentClosedAlert();
      const claimedAlert = { ...alert, notificationChannelId: faker.string.uuid() };
      const provider = mockAkashAddress();
      alertRepository.claimNotification.mockResolvedValue(claimedAlert);
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: now, lastSentAt: null });

      const result = await service.recordLeaseClosure(alert, {
        owner: mockAkashAddress(),
        dseq: "1001",
        provider,
        reason: LeaseClosedReason.lease_closed_reason_unstable
      });

      expect(result).toBe(claimedAlert);
      expect(providerHostService.labelFor).toHaveBeenCalledWith(provider);
      expect(alertRepository.claimNotification).toHaveBeenCalledWith(alert.id, "leaseClosedNotifiedAt", tx);
      expect(closureNoticeRepository.lockChannel).toHaveBeenCalledWith(claimedAlert.notificationChannelId, tx);
      expect(closureNoticeRepository.lockChannel).toHaveBeenCalledBefore(closureNoticeRepository.hasSentDeploymentClosure);
      expect(closureNoticeRepository.hasSentDeploymentClosure).toHaveBeenCalledWith(claimedAlert.id, tx);
      expect(closureNoticeRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          alertId: alert.id,
          notificationChannelId: claimedAlert.notificationChannelId,
          deploymentClosed: false,
          providerLabel: "provider.example.com",
          leaseClosedReason: LeaseClosedReason.lease_closed_reason_unstable,
          createdAt: now
        }),
        tx
      );
      expect(closureNoticeRepository.findChannelState).toHaveBeenCalledWith(claimedAlert.notificationChannelId);
      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.closureAlertsDue, { notificationChannelId: claimedAlert.notificationChannelId }, expect.anything());
    });

    it("records nothing when the lease or reclaim notification was already claimed, yet schedules the alert's channel", async () => {
      const { service, alertRepository, closureNoticeRepository } = setup();
      const alert = generateDeploymentClosedAlert();
      alertRepository.claimNotification.mockResolvedValue(undefined);

      const result = await service.recordLeaseClosure(alert, { owner: mockAkashAddress(), dseq: "1001", provider: mockAkashAddress(), reason: 1 });

      expect(result).toBeUndefined();
      expect(closureNoticeRepository.record).not.toHaveBeenCalled();
      expect(closureNoticeRepository.findChannelState).toHaveBeenCalledWith(alert.notificationChannelId);
    });

    it("records nothing for a lease that closed after its deployment's closure was emailed", async () => {
      const { service, alertRepository, closureNoticeRepository } = setup();
      const alert = generateDeploymentClosedAlert();
      alertRepository.claimNotification.mockResolvedValue(alert);
      closureNoticeRepository.hasSentDeploymentClosure.mockResolvedValue(true);

      const result = await service.recordLeaseClosure(alert, { owner: mockAkashAddress(), dseq: "1001", provider: mockAkashAddress(), reason: 1 });

      expect(result).toBe(alert);
      expect(closureNoticeRepository.record).not.toHaveBeenCalled();
    });
  });

  describe("flush", () => {
    it("sends the closures held long enough as one email, then schedules what is left and drops notices past the digest window", async () => {
      const { service, closureNoticeRepository, brokerService, loggerService, tx, now } = setup();
      const notificationChannelId = faker.string.uuid();
      const notices = [generateClosureNotice({ notificationChannelId }), generateClosureNotice({ notificationChannelId })];
      const leftOverAt = subSeconds(now, 30);
      closureNoticeRepository.findChannelState
        .mockResolvedValueOnce({ oldestPendingAt: subSeconds(now, HOLD_SECONDS), lastSentAt: null })
        .mockResolvedValueOnce({ oldestPendingAt: leftOverAt, lastSentAt: now });
      closureNoticeRepository.claimPending.mockResolvedValue(notices);

      await service.flush(notificationChannelId);

      expect(closureNoticeRepository.lockingChannel).toHaveBeenCalledWith(notificationChannelId, expect.any(Function));
      expect(closureNoticeRepository.findChannelState).toHaveBeenNthCalledWith(1, notificationChannelId, tx);
      expect(closureNoticeRepository.claimPending).toHaveBeenCalledWith(notificationChannelId, { createdUpTo: subSeconds(now, HOLD_SECONDS), sentAt: now }, tx);
      const { category, payload } = toClosureEmail(notices);
      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.createNotification, { notificationChannelId, category, payload });
      expect(loggerService.info).toHaveBeenCalledWith({ event: "CLOSURE_ALERTS_SENT", notificationChannelId, category, noticeCount: 2 });
      expect(brokerService.publish).toHaveBeenCalledWith(
        eventKeyRegistry.closureAlertsDue,
        { notificationChannelId },
        { singletonKey: notificationChannelId, startAfter: addSeconds(now, DIGEST_WINDOW_SECONDS) }
      );
      expect(closureNoticeRepository.deleteSentBefore).toHaveBeenCalledWith(subSeconds(now, DIGEST_WINDOW_SECONDS));
    });

    it("sends nothing before the channel's digest window is over and schedules the flush for its end", async () => {
      const { service, closureNoticeRepository, brokerService, now } = setup();
      const notificationChannelId = faker.string.uuid();
      const lastSentAt = subSeconds(now, 600);
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: subSeconds(now, HOLD_SECONDS * 2), lastSentAt });

      await service.flush(notificationChannelId);

      expect(closureNoticeRepository.claimPending).not.toHaveBeenCalled();
      expect(brokerService.publish).toHaveBeenCalledTimes(1);
      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.closureAlertsDue, expect.anything(), {
        singletonKey: notificationChannelId,
        startAfter: addSeconds(lastSentAt, DIGEST_WINDOW_SECONDS)
      });
    });

    it("stamps the closures it sends with the time it got the channel's lock, not the time it started waiting for it", async () => {
      const { service, closureNoticeRepository, tx, now } = setup();
      const lockedAt = addSeconds(now, 300);
      closureNoticeRepository.lockingChannel.mockImplementation((_, work) => {
        vi.setSystemTime(lockedAt);
        return work(tx);
      });
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: now, lastSentAt: null });
      closureNoticeRepository.claimPending.mockResolvedValue([generateClosureNotice({})]);

      await service.flush(faker.string.uuid());

      expect(closureNoticeRepository.claimPending).toHaveBeenCalledWith(expect.any(String), { createdUpTo: subSeconds(lockedAt, HOLD_SECONDS), sentAt: lockedAt }, tx);
    });

    it("sends the digest the moment the digest window is over", async () => {
      const { service, closureNoticeRepository, brokerService, now } = setup();
      closureNoticeRepository.findChannelState.mockResolvedValueOnce({
        oldestPendingAt: subSeconds(now, HOLD_SECONDS * 2),
        lastSentAt: subSeconds(now, DIGEST_WINDOW_SECONDS)
      });
      closureNoticeRepository.claimPending.mockResolvedValue([generateClosureNotice({})]);

      await service.flush(faker.string.uuid());

      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.createNotification, expect.anything());
    });

    it("sends nothing while the channel's oldest closure is still held", async () => {
      const { service, closureNoticeRepository, brokerService, now } = setup();
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: subSeconds(now, HOLD_SECONDS - 1), lastSentAt: null });

      await service.flush(faker.string.uuid());

      expect(closureNoticeRepository.claimPending).not.toHaveBeenCalled();
      expect(brokerService.publish).not.toHaveBeenCalledWith(eventKeyRegistry.createNotification, expect.anything());
    });

    it("sends nothing when the channel has no pending closure", async () => {
      const { service, closureNoticeRepository, brokerService } = setup();
      closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: null, lastSentAt: null });

      await service.flush(faker.string.uuid());

      expect(closureNoticeRepository.claimPending).not.toHaveBeenCalled();
      expect(brokerService.publish).not.toHaveBeenCalled();
    });
  });

  function generateDeploymentClosedAlert(overrides: Parameters<typeof generateGeneralAlert>[0] = {}) {
    return generateGeneralAlert({ type: "CHAIN_EVENT", params: { dseq: "1001", type: "DEPLOYMENT_CLOSED" }, ...overrides });
  }

  function setup() {
    const now = new Date("2026-11-16T12:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const tx = mock<Parameters<Parameters<ClosureNoticeRepository["transaction"]>[0]>[0]>();
    const alertRepository = mock<AlertRepository>();
    const closureNoticeRepository = mock<ClosureNoticeRepository>({
      transaction: vi.fn(work => work(tx)),
      lockingChannel: vi.fn((_, work) => work(tx))
    });
    closureNoticeRepository.hasSentDeploymentClosure.mockResolvedValue(false);
    closureNoticeRepository.findChannelState.mockResolvedValue({ oldestPendingAt: null, lastSentAt: null });
    const deploymentReferenceService = mock<DeploymentReferenceService>();
    deploymentReferenceService.referTo.mockResolvedValue({ label: "“my-app”", link: "LINK" });
    const providerHostService = mock<ProviderHostService>();
    providerHostService.labelFor.mockResolvedValue("provider.example.com");
    const brokerService = mock<BrokerService>();
    const config: Record<string, number> = {
      "alert.CLOSURE_ALERT_HOLD_SECONDS": HOLD_SECONDS,
      "alert.CLOSURE_ALERT_DIGEST_WINDOW_SECONDS": DIGEST_WINDOW_SECONDS
    };
    const configService = mock<ConfigService<AlertConfig>>({ getOrThrow: vi.fn((key: string) => config[key]) as ConfigService<AlertConfig>["getOrThrow"] });
    const loggerService = mock<LoggerService>();
    const service = new ClosureAlertService(
      alertRepository,
      closureNoticeRepository,
      deploymentReferenceService,
      providerHostService,
      brokerService,
      configService,
      loggerService
    );

    return { service, alertRepository, closureNoticeRepository, deploymentReferenceService, providerHostService, brokerService, loggerService, tx, now };
  }
});
