import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import { isProviderUnavailableError, retryOnServerError, shouldReportQueryError, SKIP_REPORTING_PROVIDER_UNAVAILABLE } from "./query-error-policy";

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

  describe("retryOnServerError", () => {
    it("retries a server error up to three times", () => {
      expect(retryOnServerError(0, httpError(500))).toBe(true);
      expect(retryOnServerError(2, httpError(500))).toBe(true);
      expect(retryOnServerError(3, httpError(500))).toBe(false);
    });

    it("does not retry a client error", () => {
      expect(retryOnServerError(0, httpError(404))).toBe(false);
    });

    it("does not retry a non-http error", () => {
      expect(retryOnServerError(0, new Error("boom"))).toBe(false);
    });
  });

  describe("shouldReportQueryError", () => {
    it("reports when the query carries no meta", () => {
      expect(shouldReportQueryError(httpError(500), undefined)).toBe(true);
    });

    it("reports when the query opts out of a different error", () => {
      expect(shouldReportQueryError(httpError(500), SKIP_REPORTING_PROVIDER_UNAVAILABLE)).toBe(true);
    });

    it("stays quiet for the error the query opted out of", () => {
      expect(shouldReportQueryError(httpError(502), SKIP_REPORTING_PROVIDER_UNAVAILABLE)).toBe(false);
    });

    it("passes the error to the predicate", () => {
      const skipErrorReporting = vi.fn().mockReturnValue(false);
      const error = httpError(500);

      shouldReportQueryError(error, { skipErrorReporting });

      expect(skipErrorReporting).toHaveBeenCalledWith(error);
    });

    it("reports when meta holds no predicate", () => {
      expect(shouldReportQueryError(httpError(502), { somethingElse: true })).toBe(true);
    });
  });

  function httpError(status: number) {
    return new AxiosError("Request failed", String(status), undefined, undefined, { status } as never);
  }
});
