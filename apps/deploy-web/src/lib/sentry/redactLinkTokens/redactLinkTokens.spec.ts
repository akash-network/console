import type { ErrorEvent, Event } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { redactBreadcrumbTokens, redactEventTokens, redactUrlTokens } from "./redactLinkTokens";

describe("redactLinkTokens", () => {
  describe(redactUrlTokens.name, () => {
    it.each([
      ["/invitations#token=Abc_def-123", "/invitations#token=[redacted]"],
      ["/user/confirm-delete?ref=mail#token=secret&step=2", "/user/confirm-delete?ref=mail#token=[redacted]&step=2"],
      ["https://console.akash.network/a?token=one&x=1", "https://console.akash.network/a?token=[redacted]&x=1"],
      ["/b#from=mail&TOKEN=two", "/b#from=mail&TOKEN=[redacted]"],
      ["token=three&x=1", "token=[redacted]&x=1"],
      ["/c;token=four", "/c;token=[redacted]"]
    ])("redacts %s", (url, redacted) => {
      expect(redactUrlTokens(url)).toBe(redacted);
    });

    it.each(["/deployments", "/x?mytoken=keep", "/y#accesstoken=keep"])("leaves %s alone", url => {
      expect(redactUrlTokens(url)).toBe(url);
    });
  });

  describe(redactBreadcrumbTokens.name, () => {
    it("redacts both ends of a navigation", () => {
      const breadcrumb = redactBreadcrumbTokens({ category: "navigation", data: { from: "/invitations#token=abc", to: "/invitations" } });

      expect(breadcrumb).toEqual({ category: "navigation", data: { from: "/invitations#token=[redacted]", to: "/invitations" } });
    });

    it.each(["fetch", "xhr"])("redacts the url of a %s breadcrumb and keeps its other data", category => {
      const breadcrumb = redactBreadcrumbTokens({ category, data: { method: "GET", url: "/api/x?token=abc", status_code: 200 } });

      expect(breadcrumb.data).toEqual({ method: "GET", url: "/api/x?token=[redacted]", status_code: 200 });
    });

    it("redacts a message that carries a link", () => {
      expect(redactBreadcrumbTokens({ category: "console", message: "opened /invitations#token=abc" }).message).toBe("opened /invitations#token=[redacted]");
    });

    it("keeps non-string values and breadcrumbs without data", () => {
      const bare = { category: "ui.click" };

      expect(redactBreadcrumbTokens({ category: "navigation", data: { from: undefined, to: 42 } }).data).toEqual({ from: undefined, to: 42 });
      expect(redactBreadcrumbTokens(bare)).toEqual(bare);
    });
  });

  describe(redactEventTokens.name, () => {
    it("redacts the page url, query, referer and transaction name of an error", () => {
      const event: ErrorEvent = {
        type: undefined,
        transaction: "/invitations#token=abc",
        request: {
          url: "https://console.akash.network/invitations#token=abc",
          query_string: "token=abc&x=1",
          headers: { Referer: "https://console.akash.network/user/confirm-delete?token=abc", "User-Agent": "test" }
        }
      };

      expect(redactEventTokens(event)).toEqual({
        type: undefined,
        transaction: "/invitations#token=[redacted]",
        request: {
          url: "https://console.akash.network/invitations#token=[redacted]",
          query_string: "token=[redacted]&x=1",
          headers: { Referer: "https://console.akash.network/user/confirm-delete?token=[redacted]", "User-Agent": "test" }
        }
      });
    });

    it("redacts span names and url data of a transaction, and its trace context", () => {
      const event: Event = {
        type: "transaction",
        transaction: "/invitations",
        spans: [
          {
            span_id: "1",
            trace_id: "t",
            start_timestamp: 0,
            description: "GET /api/x?token=abc",
            data: { "http.url": "/api/x?token=abc", "http.fragment": "#token=abc", "http.method": "GET" }
          },
          { span_id: "2", trace_id: "t", start_timestamp: 0, data: { "sentry.op": "ui.click" } }
        ],
        contexts: { trace: { span_id: "0", trace_id: "t", data: { url: "/invitations#token=abc", "sentry.op": "pageload" } } }
      };

      const redacted = redactEventTokens(event);

      expect(redacted.spans).toEqual([
        {
          span_id: "1",
          trace_id: "t",
          start_timestamp: 0,
          description: "GET /api/x?token=[redacted]",
          data: { "http.url": "/api/x?token=[redacted]", "http.fragment": "#token=[redacted]", "http.method": "GET" }
        },
        { span_id: "2", trace_id: "t", start_timestamp: 0, data: { "sentry.op": "ui.click" } }
      ]);
      expect(redacted.contexts?.trace?.data).toEqual({ url: "/invitations#token=[redacted]", "sentry.op": "pageload" });
    });

    it("leaves an event without urls as it is", () => {
      const event: ErrorEvent = { type: undefined, message: "boom", request: { method: "GET" }, contexts: { trace: { span_id: "0", trace_id: "t" } } };

      expect(redactEventTokens(event)).toEqual(event);
    });
  });
});
