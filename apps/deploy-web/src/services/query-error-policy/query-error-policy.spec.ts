import { ApiError } from "@akashnetwork/openapi-sdk";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import {
  isProviderTokenRejection,
  isProviderUnavailableError,
  retryOnServerError,
  shouldReportError,
  SKIP_REPORTING_HANDLED_BY_CALLER,
  SKIP_REPORTING_PROVIDER_POLL_FAILURE
} from "./query-error-policy";

const EXPIRED_TOKEN_BODY = {
  success: false,
  error: {
    issues: [{ code: "custom", message: "is not a valid JWT token", path: ["auth", "token"], params: { errors: ["Token has expired"] } }],
    name: "ZodError"
  }
};

describe("query-error-policy", () => {
  describe("isProviderUnavailableError", () => {
    it.each([502, 503])("is true for a %s from the provider proxy", status => {
      expect(isProviderUnavailableError(httpError(status))).toBe(true);
    });

    it.each([404, 500, 400])("is false for a %s", status => {
      expect(isProviderUnavailableError(httpError(status))).toBe(false);
    });

    it("is false when there is no response at all", () => {
      expect(isProviderUnavailableError(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(false);
    });

    it("is false for a non-http error", () => {
      expect(isProviderUnavailableError(new Error("boom"))).toBe(false);
    });
  });

  describe("isProviderTokenRejection", () => {
    it("is true for the proxy's expired-token rejection", () => {
      expect(isProviderTokenRejection(httpError(400, EXPIRED_TOKEN_BODY))).toBe(true);
    });

    it("is false for a 400 whose issue points at another field", () => {
      expect(isProviderTokenRejection(httpError(400, { error: { issues: [{ path: ["auth", "certPem"] }] } }))).toBe(false);
    });

    it.each([
      ["a body with no issues", { error: {} }],
      ["a body that is not an object", "Could not establish tls connection"],
      ["no body", undefined]
    ])("is false for %s", (_name, data) => {
      expect(isProviderTokenRejection(httpError(400, data))).toBe(false);
    });

    it("is false for the same body on a status other than 400", () => {
      expect(isProviderTokenRejection(httpError(503, EXPIRED_TOKEN_BODY))).toBe(false);
    });

    it("is false for a non-http error", () => {
      expect(isProviderTokenRejection(new Error("boom"))).toBe(false);
    });
  });

  describe("retryOnServerError", () => {
    it("retries a server error up to three times", () => {
      expect(retryOnServerError(0, httpError(500))).toBe(true);
      expect(retryOnServerError(2, httpError(500))).toBe(true);
      expect(retryOnServerError(3, httpError(500))).toBe(false);
    });

    it("does not retry a client error", () => {
      expect(retryOnServerError(0, httpError(404))).toBe(false);
    });

    it("retries a server error the typed api client raised, which is not an axios one", () => {
      expect(retryOnServerError(0, new ApiError(503, undefined, "GET /v1/deployments \u2192 503"))).toBe(true);
    });

    it("does not retry a client error the typed api client raised", () => {
      expect(retryOnServerError(0, new ApiError(404, undefined, "GET /v1/deployments \u2192 404"))).toBe(false);
    });

    it("gives up on the typed api client after three attempts, like any other server error", () => {
      expect(retryOnServerError(3, new ApiError(500, undefined, "GET /v1/deployments \u2192 500"))).toBe(false);
    });

    it("does not retry a non-http error", () => {
      expect(retryOnServerError(0, new Error("boom"))).toBe(false);
    });
  });

  describe("shouldReportError", () => {
    it("reports when the query carries no meta", () => {
      expect(shouldReportError(httpError(500), undefined)).toBe(true);
    });

    it("reports when the query opts out of a different error", () => {
      expect(shouldReportError(httpError(500), SKIP_REPORTING_PROVIDER_POLL_FAILURE)).toBe(true);
    });

    it("stays quiet for the error the query opted out of", () => {
      expect(shouldReportError(httpError(502), SKIP_REPORTING_PROVIDER_POLL_FAILURE)).toBe(false);
    });

    it("passes the error to the predicate", () => {
      const skipErrorReporting = vi.fn().mockReturnValue(false);
      const error = httpError(500);

      shouldReportError(error, { skipErrorReporting });

      expect(skipErrorReporting).toHaveBeenCalledWith(error);
    });

    it("reports when meta holds no predicate", () => {
      expect(shouldReportError(httpError(502), { somethingElse: true })).toBe(true);
    });
  });

  describe("SKIP_REPORTING_PROVIDER_POLL_FAILURE", () => {
    it.each([400, 404, 429, 495])("stays quiet for a %s", status => {
      expect(shouldReportError(httpError(status), SKIP_REPORTING_PROVIDER_POLL_FAILURE)).toBe(false);
    });

    it.each([502, 503])("stays quiet for a %s", status => {
      expect(shouldReportError(httpError(status), SKIP_REPORTING_PROVIDER_POLL_FAILURE)).toBe(false);
    });

    it.each([500, 504])("reports a %s", status => {
      expect(shouldReportError(httpError(status), SKIP_REPORTING_PROVIDER_POLL_FAILURE)).toBe(true);
    });

    it("reports a non-http error", () => {
      expect(shouldReportError(new Error("boom"), SKIP_REPORTING_PROVIDER_POLL_FAILURE)).toBe(true);
    });
  });

  describe("SKIP_REPORTING_HANDLED_BY_CALLER", () => {
    it("suppresses cache-level reporting whatever the error", () => {
      expect(shouldReportError(httpError(500), SKIP_REPORTING_HANDLED_BY_CALLER)).toBe(false);
      expect(shouldReportError(new Error("boom"), SKIP_REPORTING_HANDLED_BY_CALLER)).toBe(false);
    });
  });

  function httpError(status: number, data?: unknown) {
    return new AxiosError("Request failed", String(status), undefined, undefined, { status, data } as never);
  }
});
