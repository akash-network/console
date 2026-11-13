import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { describeTemplateRefusal } from "./describeTemplateRefusal";

describe(describeTemplateRefusal.name, () => {
  it("lists every issue the API found", () => {
    const error = new ApiError(
      400,
      { code: "template_invalid", message: "ignored", data: { issues: ["web: env HF_TOKEN holds a secret", "db: env PASSWORD holds a secret"] } },
      "400"
    );

    expect(describeTemplateRefusal(error)).toBe("web: env HF_TOKEN holds a secret; db: env PASSWORD holds a secret");
  });

  it("falls back to the message when there are no issues", () => {
    expect(describeTemplateRefusal(new ApiError(400, { message: "Body is invalid", data: { issues: [] } }, "400"))).toBe("Body is invalid");
    expect(describeTemplateRefusal(new ApiError(400, { message: "Body is invalid", data: { issues: "nope" } }, "400"))).toBe("Body is invalid");
  });

  it("skips blank or non-text issues", () => {
    expect(describeTemplateRefusal(new ApiError(400, { message: "m", data: { issues: ["", 3, "real one"] } }, "400"))).toBe("real one");
  });

  it("has nothing to say without a reason", () => {
    expect(describeTemplateRefusal(new ApiError(400, {}, "400"))).toBeUndefined();
    expect(describeTemplateRefusal(new ApiError(400, { message: "" }, "400"))).toBeUndefined();
    expect(describeTemplateRefusal(new ApiError(400, null, "400"))).toBeUndefined();
  });

  it("leaves other failures alone", () => {
    expect(describeTemplateRefusal(new ApiError(503, { message: "Unavailable" }, "503"))).toBeUndefined();
    expect(describeTemplateRefusal(new Error("boom"))).toBeUndefined();
  });
});
