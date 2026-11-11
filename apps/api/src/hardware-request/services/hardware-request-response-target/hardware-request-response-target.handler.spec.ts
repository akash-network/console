import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DEFAULT_GPU_REQUEST_ROUTING_POLICY, type SalesOwner } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { ResponseTarget } from "@src/hardware-request/lib/hardware-request-response-schedule/hardware-request-response-schedule";
import type { HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import type { HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import type {
  HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import type { GpuRequestRoutingService } from "@src/hardware-request/services/gpu-request-routing/gpu-request-routing.service";
import type { HardwareRequestAlertContextService } from "@src/hardware-request/services/hardware-request-alert-context/hardware-request-alert-context.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import type { CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import { HardwareRequestResponseTargetHandler } from "./hardware-request-response-target.handler";
import type { ResponseTargetStage } from "./hardware-request-response-target-notice";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

const WEBHOOK_URL = "https://hooks.slack.test/services/T000/B000/hardware";
const LEAD: SalesOwner = { name: "Lead", slackUserId: "U-LEAD", email: "lead@akash.network" };

describe(HardwareRequestResponseTargetHandler.name, () => {
  it("reminds the owner by email of a reply due soon and records the reminder", async () => {
    const { handler, notificationService, slackWebhookClient, hardwareRequestEventRepository, hardwareRequest } = setup({
      owner: { name: "Remington", email: "remington@akash.network" }
    });

    await handler.handle(aPayload(hardwareRequest.id, "first_reply", "reminder"));

    const notification = sentNotification(notificationService);
    expect(notification).toMatchObject({
      notificationId: `hardwareRequestResponseTarget.${hardwareRequest.id}.first_reply.reminder`,
      user: { id: emailRecipientUserId("remington@akash.network"), email: "remington@akash.network" }
    });
    expect(notification.payload.description.replaceAll(" ", " ")).toContain("is due by Tue, Nov 10, 2:00 PM EST.");
    expect(slackWebhookClient.post).not.toHaveBeenCalled();
    expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
      hardwareRequestId: hardwareRequest.id,
      type: "reminder_sent",
      actor: null,
      payload: { target: "first_reply" }
    });
  });

  it("escalates a missed target to the sales channel and emails the lead", async () => {
    const { handler, notificationService, slackWebhookClient, hardwareRequestEventRepository, hardwareRequest } = setup({
      owner: { name: "Remington", slackUserId: "U-OWNER", email: "remington@akash.network" },
      salesLead: LEAD
    });

    await handler.handle(aPayload(hardwareRequest.id, "first_offer", "escalation"));

    expect(sentNotification(notificationService).user).toEqual({ id: emailRecipientUserId("lead@akash.network"), email: "lead@akash.network" });
    expect(slackWebhookClient.post).toHaveBeenCalledWith(WEBHOOK_URL, { text: expect.stringContaining("<@U-LEAD> · <@U-OWNER> · Request") });
    expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
      hardwareRequestId: hardwareRequest.id,
      type: "escalated",
      actor: null,
      payload: { target: "first_offer" }
    });
  });

  it.each([
    { stage: "reminder" as const, input: { salesLead: LEAD } },
    { stage: "escalation" as const, input: { owner: { name: "Remington", email: "remington@akash.network" } } }
  ])("emails the shared mailbox a $stage nobody else gets", async ({ stage, input }) => {
    const { handler, notificationService, hardwareRequest } = setup(input);

    await handler.handle(aPayload(hardwareRequest.id, "first_reply", stage));

    expect(sentNotification(notificationService).user).toEqual({ id: emailRecipientUserId("support@akash.network"), email: "support@akash.network" });
  });

  it("records a reminder without emailing anyone while response target emails are off", async () => {
    const { handler, notificationService, hardwareRequestEventRepository, hardwareRequest } = setup({
      areEmailsEnabled: false,
      owner: { name: "Remington", email: "remington@akash.network" }
    });

    await handler.handle(aPayload(hardwareRequest.id, "first_reply", "reminder"));

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
      hardwareRequestId: hardwareRequest.id,
      type: "reminder_sent",
      actor: null,
      payload: { target: "first_reply" }
    });
  });

  it("escalates to the sales channel without emailing the lead while response target emails are off", async () => {
    const { handler, notificationService, slackWebhookClient, hardwareRequestEventRepository, hardwareRequest } = setup({
      areEmailsEnabled: false,
      salesLead: LEAD
    });

    await handler.handle(aPayload(hardwareRequest.id, "first_offer", "escalation"));

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(slackWebhookClient.post).toHaveBeenCalledWith(WEBHOOK_URL, { text: expect.stringContaining("<@U-LEAD> · Request") });
    expect(hardwareRequestEventRepository.record).toHaveBeenCalledWith({
      hardwareRequestId: hardwareRequest.id,
      type: "escalated",
      actor: null,
      payload: { target: "first_offer" }
    });
  });

  it("skips Slack when no webhook is configured", async () => {
    const { handler, slackWebhookClient, hardwareRequestEventRepository, hardwareRequest } = setup({ webhookUrl: undefined });

    await handler.handle(aPayload(hardwareRequest.id, "first_reply", "escalation"));

    expect(slackWebhookClient.post).not.toHaveBeenCalled();
    expect(hardwareRequestEventRepository.record).toHaveBeenCalled();
  });

  it("counts only a published offer toward the first offer target", async () => {
    const { handler, notificationService, hardwareRequestOfferRepository, hardwareRequest } = setup({ offers: [{ publishedAt: null }] });

    await handler.handle(aPayload(hardwareRequest.id, "first_offer", "reminder"));

    expect(hardwareRequestOfferRepository.findOldestFirst).toHaveBeenCalledWith(hardwareRequest.id);
    expect(notificationService.createNotification).toHaveBeenCalled();
  });

  it.each([
    { case: "the first reply came", target: "first_reply" as const, input: { firstRepliedAt: "2026-11-10T16:00:00.000Z" } },
    { case: "an offer was published", target: "first_offer" as const, input: { offers: [{ publishedAt: null }, { publishedAt: "2026-11-10T16:00:00.000Z" }] } },
    ...(["accepted", "fulfilled", "withdrawn", "closed"] as const).map(status => ({
      case: `the request is ${status}`,
      target: "first_offer" as const,
      input: { status }
    }))
  ])("does nothing once $case", async ({ target, input }) => {
    const { handler, notificationService, slackWebhookClient, hardwareRequestEventRepository, hardwareRequest } = setup(input);

    await handler.handle(aPayload(hardwareRequest.id, target, "escalation"));

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(slackWebhookClient.post).not.toHaveBeenCalled();
    expect(hardwareRequestEventRepository.record).not.toHaveBeenCalled();
  });

  it("skips with a warning when the request is gone", async () => {
    const { handler, hardwareRequestRepository, notificationService, logger, createLogger } = setup();
    hardwareRequestRepository.findById.mockResolvedValue(undefined);

    await handler.handle(aPayload("request-1", "first_reply", "reminder"));

    expect(createLogger).toHaveBeenCalledWith({ context: HardwareRequestResponseTargetHandler.name });
    expect(logger.warn).toHaveBeenCalledWith({
      event: "HARDWARE_REQUEST_RESPONSE_TARGET_SKIPPED",
      hardwareRequestId: "request-1",
      reason: "Hardware request not found"
    });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  function aPayload(hardwareRequestId: string, target: ResponseTarget, stage: ResponseTargetStage) {
    return { hardwareRequestId, target, stage, dueAt: "2026-11-10T19:00:00.000Z", version: 1 as const };
  }

  function sentNotification(notificationService: NotificationService): CreateNotificationInput {
    return vi.mocked(notificationService.createNotification).mock.calls[0][0];
  }

  function setup(
    input: {
      owner?: SalesOwner;
      salesLead?: SalesOwner;
      webhookUrl?: string;
      firstRepliedAt?: string;
      status?: HardwareRequestStatus;
      offers?: Array<Pick<HardwareRequestOfferOutput, "publishedAt">>;
      areEmailsEnabled?: boolean;
    } = {}
  ) {
    const hardwareRequest = createHardwareRequest({ status: input.status ?? "sourcing", firstRepliedAt: input.firstRepliedAt ?? null });
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.findById.mockResolvedValue(hardwareRequest);
    const hardwareRequestOfferRepository = mock<HardwareRequestOfferRepository>();
    hardwareRequestOfferRepository.findOldestFirst.mockResolvedValue((input.offers ?? []).map(offer => mock<HardwareRequestOfferOutput>(offer)));
    const hardwareRequestEventRepository = mock<HardwareRequestEventRepository>();
    const hardwareRequestAlertContextService = mock<HardwareRequestAlertContextService>();
    hardwareRequestAlertContextService.load.mockResolvedValue({ organizationName: undefined, accountType: "paying", owner: input.owner });
    const gpuRequestRoutingService = mock<GpuRequestRoutingService>();
    gpuRequestRoutingService.getPolicy.mockReturnValue({ ...DEFAULT_GPU_REQUEST_ROUTING_POLICY, salesLead: input.salesLead });
    const notificationService = mock<NotificationService>();
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockImplementation(flag => flag === FeatureFlags.GPU_REQUEST_RESPONSE_TARGET_EMAILS && (input.areEmailsEnabled ?? true));
    const config = mock<HardwareRequestConfig>({
      HARDWARE_REQUEST_EMAIL: "support@akash.network",
      HARDWARE_REQUEST_SLACK_WEBHOOK_URL: "webhookUrl" in input ? input.webhookUrl : WEBHOOK_URL
    });
    const slackWebhookClient = mock<HttpClient>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new HardwareRequestResponseTargetHandler(
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      hardwareRequestEventRepository,
      hardwareRequestAlertContextService,
      gpuRequestRoutingService,
      notificationService,
      featureFlagsService,
      config,
      slackWebhookClient,
      createLogger
    );

    return {
      handler,
      hardwareRequest,
      hardwareRequestRepository,
      hardwareRequestOfferRepository,
      hardwareRequestEventRepository,
      notificationService,
      slackWebhookClient,
      logger,
      createLogger
    };
  }
});
