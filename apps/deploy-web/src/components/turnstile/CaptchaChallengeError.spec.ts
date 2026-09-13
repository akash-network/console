import { describe, expect, it } from "vitest";

import type { CaptchaChallengeReason } from "./CaptchaChallengeError";
import { CaptchaChallengeError, SKIP_REPORTING_CAPTCHA_OUTCOME } from "./CaptchaChallengeError";

describe(CaptchaChallengeError.name, () => {
  it.each<CaptchaChallengeReason>(["abandoned", "timeout", "dismissed", "error"])("carries a message the visitor can read for %s", reason => {
    expect(new CaptchaChallengeError(reason).message).toMatch(/^Verification .+\.$/);
  });

  it("survives instanceof against both its own type and Error", () => {
    const error = new CaptchaChallengeError("abandoned");

    expect(error).toBeInstanceOf(CaptchaChallengeError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CaptchaChallengeError");
  });

  it("keeps the cloudflare error code when there is one", () => {
    expect(new CaptchaChallengeError("error", "300010").code).toBe("300010");
  });

  describe("SKIP_REPORTING_CAPTCHA_OUTCOME", () => {
    it("skips reporting for a captcha outcome", () => {
      expect(SKIP_REPORTING_CAPTCHA_OUTCOME.skipErrorReporting(new CaptchaChallengeError("timeout"))).toBe(true);
    });

    it("leaves every other failure reportable", () => {
      expect(SKIP_REPORTING_CAPTCHA_OUTCOME.skipErrorReporting(new Error("auth api is down"))).toBe(false);
      expect(SKIP_REPORTING_CAPTCHA_OUTCOME.skipErrorReporting({ reason: "timeout" })).toBe(false);
    });
  });
});
