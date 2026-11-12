import { describe, expect, it } from "vitest";

import { createTemplateInvalidError } from "./template-invalid-error";

describe(createTemplateInvalidError.name, () => {
  it("answers 400 template_invalid with every issue in the message and the data", () => {
    const issues = ["First issue", "Second issue"];

    expect(createTemplateInvalidError(issues)).toMatchObject({
      status: 400,
      message: "First issue; Second issue",
      errorCode: "template_invalid",
      data: { issues }
    });
  });
});
