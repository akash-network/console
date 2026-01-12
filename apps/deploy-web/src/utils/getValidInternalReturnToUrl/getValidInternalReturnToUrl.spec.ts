import { getValidInternalReturnToUrl } from "./getValidInternalReturnToUrl";

describe("getValidInternalReturnToUrl", () => {
  describe("when returnTo is null or empty", () => {
    it("returns '/' for null input", () => {
      expect(getValidInternalReturnToUrl(null)).toBe("/");
    });

    it("returns '/' for empty string", () => {
      expect(getValidInternalReturnToUrl("")).toBe("/");
    });
  });

  describe("valid relative paths", () => {
    it("returns the path when it starts with '/'", () => {
      expect(getValidInternalReturnToUrl("/dashboard")).toBe("/dashboard");
    });

    it("returns the path with query parameters", () => {
      expect(getValidInternalReturnToUrl("/dashboard?tab=settings")).toBe("/dashboard?tab=settings");
    });

    it("returns the path with hash", () => {
      expect(getValidInternalReturnToUrl("/dashboard#section")).toBe("/dashboard#section");
    });

    it("returns the path with query and hash", () => {
      expect(getValidInternalReturnToUrl("/dashboard?tab=settings#section")).toBe("/dashboard?tab=settings#section");
    });

    it("returns '/' for root path", () => {
      expect(getValidInternalReturnToUrl("/")).toBe("/");
    });

    it("handles encoded paths", () => {
      expect(getValidInternalReturnToUrl(encodeURIComponent("/user/profile"))).toBe("/user/profile");
    });

    it("handles paths with encoded characters", () => {
      expect(getValidInternalReturnToUrl("/user%20profile")).toBe("/user profile");
    });
  });

  describe("invalid paths - protocol-relative", () => {
    it("returns '/' for protocol-relative URLs starting with '//'", () => {
      expect(getValidInternalReturnToUrl("//evil.com")).toBe("/");
    });

    it("returns '/' for protocol-relative URLs with path", () => {
      expect(getValidInternalReturnToUrl("//evil.com/path")).toBe("/");
    });
  });

  describe("same-origin URLs", () => {
    const { window: mockWindow } = setup("https://console.akash.network");

    it("returns the full URL for same-origin absolute URL", () => {
      expect(getValidInternalReturnToUrl("https://console.akash.network/dashboard", mockWindow)).toBe("https://console.akash.network/dashboard");
    });

    it("returns the full URL with path and query", () => {
      expect(getValidInternalReturnToUrl("https://console.akash.network/dashboard?tab=settings", mockWindow)).toBe(
        "https://console.akash.network/dashboard?tab=settings"
      );
    });

    it("returns '/' for different origin", () => {
      expect(getValidInternalReturnToUrl("https://evil.com", mockWindow)).toBe("/");
    });

    it("returns '/' for different origin with path", () => {
      expect(getValidInternalReturnToUrl("https://evil.com/phishing", mockWindow)).toBe("/");
    });

    it("returns '/' for http when origin is https", () => {
      expect(getValidInternalReturnToUrl("http://console.akash.network/dashboard", mockWindow)).toBe("/");
    });

    it("handles encoded same-origin URLs", () => {
      const encoded = encodeURIComponent("https://console.akash.network/dashboard");
      expect(getValidInternalReturnToUrl(encoded, mockWindow)).toBe("https://console.akash.network/dashboard");
    });
  });

  describe("external URLs - open redirect prevention", () => {
    const { window: mockWindow } = setup("https://console.akash.network");

    it("returns '/' for http external URL", () => {
      expect(getValidInternalReturnToUrl("http://evil.com", mockWindow)).toBe("/");
    });

    it("returns '/' for https external URL", () => {
      expect(getValidInternalReturnToUrl("https://evil.com", mockWindow)).toBe("/");
    });

    it("returns '/' for external URL with path", () => {
      expect(getValidInternalReturnToUrl("https://evil.com/phishing", mockWindow)).toBe("/");
    });

    it("returns '/' for external URL with query parameters", () => {
      expect(getValidInternalReturnToUrl("https://evil.com?steal=cookies", mockWindow)).toBe("/");
    });

    it("returns '/' for javascript: protocol", () => {
      expect(getValidInternalReturnToUrl("javascript:alert('xss')", mockWindow)).toBe("/");
    });

    it("returns '/' for data: protocol", () => {
      expect(getValidInternalReturnToUrl("data:text/html,<script>alert('xss')</script>", mockWindow)).toBe("/");
    });

    it("returns '/' for file: protocol", () => {
      expect(getValidInternalReturnToUrl("file:///etc/passwd", mockWindow)).toBe("/");
    });
  });

  describe("server-side rendering (window undefined)", () => {
    it("returns '/' for absolute URL when window is undefined", () => {
      expect(getValidInternalReturnToUrl("https://console.akash.network/dashboard", undefined)).toBe("/");
    });

    it("returns '/' for external URL when window is undefined", () => {
      expect(getValidInternalReturnToUrl("https://evil.com", undefined)).toBe("/");
    });

    it("returns relative path when window is undefined", () => {
      expect(getValidInternalReturnToUrl("/dashboard", undefined)).toBe("/dashboard");
    });
  });

  describe("malformed URLs", () => {
    const { window: mockWindow } = setup("https://console.akash.network");

    it("returns '/' for invalid URL format", () => {
      expect(getValidInternalReturnToUrl("not-a-url", mockWindow)).toBe("/");
    });

    it("returns '/' for malformed encoded string", () => {
      expect(getValidInternalReturnToUrl("%E0%A4%A", mockWindow)).toBe("/");
    });

    it("handles decodeURIComponent errors gracefully", () => {
      const invalidEncoded = "%E0%A4%A";
      expect(() => getValidInternalReturnToUrl(invalidEncoded, mockWindow)).not.toThrow();
      expect(getValidInternalReturnToUrl(invalidEncoded, mockWindow)).toBe("/");
    });
  });

  describe("edge cases", () => {
    it("handles URLs with ports correctly", () => {
      const { window: mockWindowWithPort } = setup("https://console.akash.network:443");
      expect(getValidInternalReturnToUrl("https://console.akash.network:443/dashboard", mockWindowWithPort)).toBe("https://console.akash.network/dashboard");
      const { window: mockWindowWithoutPort } = setup("https://console.akash.network");
      expect(getValidInternalReturnToUrl("https://console.akash.network/dashboard", mockWindowWithoutPort)).toBe("https://console.akash.network/dashboard");
    });

    it("handles subdomain correctly", () => {
      const { window: mockWindowSubdomain } = setup("https://app.console.akash.network");
      expect(getValidInternalReturnToUrl("https://app.console.akash.network/dashboard", mockWindowSubdomain)).toBe(
        "https://app.console.akash.network/dashboard"
      );
      expect(getValidInternalReturnToUrl("https://console.akash.network/dashboard", mockWindowSubdomain)).toBe("/");
    });

    it("preserves trailing slashes in relative paths", () => {
      expect(getValidInternalReturnToUrl("/dashboard/", undefined)).toBe("/dashboard/");
    });

    it("handles very long paths", () => {
      const longPath = "/" + "a".repeat(1000);
      expect(getValidInternalReturnToUrl(longPath, undefined)).toBe(longPath);
    });
  });

  function setup(origin: string) {
    const window = {
      location: {
        origin
      }
    } as typeof globalThis.window;

    return { window };
  }
});
