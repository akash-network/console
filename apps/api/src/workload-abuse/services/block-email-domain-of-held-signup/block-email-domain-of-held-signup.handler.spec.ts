import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { blockEmailDomainOfHeldSignupKeyFor } from "@src/workload-abuse/events/block-email-domain-of-held-signup";
import type { EmailDomainBlockService, HeldSignupBlockEvidence } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { BlockEmailDomainOfHeldSignupHandler } from "./block-email-domain-of-held-signup.handler";

describe(BlockEmailDomainOfHeldSignupHandler.name, () => {
  it("keys the block by user, so every retry of a held activation shares one pending evaluation", () => {
    expect(blockEmailDomainOfHeldSignupKeyFor("user-7")).toBe("blockEmailDomainOfHeldSignup.user-7");
  });

  it("blocks the held user's domain with the evidence it was given", async () => {
    const { handler, payload, emailDomainBlockService } = setup();

    await handler.handle(payload);

    expect(emailDomainBlockService.blockDomainOfHeldSignup).toHaveBeenCalledWith({
      userId: payload.userId,
      emailDomain: payload.emailDomain,
      evidence: payload.evidence
    });
  });

  it("records a failure and rethrows it, so the queue retries the block", async () => {
    const { handler, payload, emailDomainBlockService, instrumentation, logger } = setup();
    const error = new Error("connection terminated");
    emailDomainBlockService.blockDomainOfHeldSignup.mockRejectedValue(error);

    await expect(handler.handle(payload)).rejects.toThrow("connection terminated");

    expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("failed");
    expect(logger.error).toHaveBeenCalledWith({ event: "EMAIL_DOMAIN_AUTO_BLOCK_FAILED", trigger: "held_signup", userId: payload.userId, error });
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("names its logger after itself", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: BlockEmailDomainOfHeldSignupHandler.name });
  });

  function setup() {
    const evidence: HeldSignupBlockEvidence = { signal: "mail_server_shared_with_blocked_domain", blockedDomain: "wexdano.org" };
    const payload = { userId: faker.string.uuid(), emailDomain: "farm.example", evidence, version: 1 as const };
    const emailDomainBlockService = mock<EmailDomainBlockService>();
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new BlockEmailDomainOfHeldSignupHandler(emailDomainBlockService, instrumentation, createLogger);

    return { handler, payload, emailDomainBlockService, instrumentation, logger, createLogger };
  }
});
