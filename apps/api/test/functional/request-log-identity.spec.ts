import { registerContextPropagation } from "@akashnetwork/instrumentation/testing";
import { LoggerService } from "@akashnetwork/logging";
import { collectOtel } from "@akashnetwork/logging/otel";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const BAGGAGE_MARKER = "baggage-marker";
const MARKER_BAGGAGE_HEADERS = {
  traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
  baggage: `user.id=${BAGGAGE_MARKER},job.id=${BAGGAGE_MARKER}`
};

describe("Request log identity", () => {
  it("logs an anonymous request without the user and job ids its baggage names", async () => {
    const { logRecords } = await setup();

    const response = await app.request("/status", { headers: MARKER_BAGGAGE_HEADERS });

    expect(response.status).toBe(200);
    expect(logRecords).toContainEqual(expect.objectContaining({ traceId: TRACE_ID, httpRequest: expect.objectContaining({ status: 200 }) }));
    expect(logRecords).not.toContainEqual(expect.objectContaining({ userId: expect.anything() }));
    expect(logRecords).not.toContainEqual(expect.objectContaining({ jobId: expect.anything() }));
  });

  it("logs a request with an invalid API key without the user and job ids its baggage names", async () => {
    const { logRecords } = await setup();

    const response = await app.request("/v1/user/me", { headers: { ...MARKER_BAGGAGE_HEADERS, "x-api-key": "not-an-api-key" } });

    expect(response.status).toBe(401);
    expect(logRecords).toContainEqual(expect.objectContaining({ traceId: TRACE_ID, httpRequest: expect.objectContaining({ status: 401 }) }));
    expect(logRecords).not.toContainEqual(expect.objectContaining({ userId: expect.anything() }));
    expect(logRecords).not.toContainEqual(expect.objectContaining({ jobId: expect.anything() }));
  });

  it("logs a signed-in request with the user's own id and without the job id its baggage names", async () => {
    const { logRecords, user, authorization } = await setup();

    const response = await app.request("/v1/user/me", { headers: { ...MARKER_BAGGAGE_HEADERS, authorization } });

    expect(response.status).toBe(200);
    expect(logRecords).toContainEqual(expect.objectContaining({ traceId: TRACE_ID, userId: user.id, httpRequest: expect.objectContaining({ status: 200 }) }));
    expect(logRecords).not.toContainEqual(expect.objectContaining({ userId: BAGGAGE_MARKER }));
    expect(logRecords).not.toContainEqual(expect.objectContaining({ jobId: expect.anything() }));
  });

  async function setup() {
    onTestFinished(registerContextPropagation());
    onTestFinished(() => {
      vi.restoreAllMocks();
    });

    const logRecords: Record<string, unknown>[] = [];
    for (const level of ["debug", "info", "warn", "error", "fatal"] as const) {
      vi.spyOn(LoggerService.prototype, level).mockImplementation(record => {
        logRecords.push({ ...collectOtel(), ...(record as object) });
      });
    }

    const user = await container.resolve(UserRepository).create({
      userId: faker.string.uuid(),
      username: `user-${faker.string.alphanumeric(12)}`,
      email: faker.internet.email().toLowerCase(),
      emailVerified: true
    });
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId : null
    );

    return { logRecords, user, authorization: `Bearer ${token}` };
  }
});
