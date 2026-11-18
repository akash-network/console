import { describe, expect, it } from "vitest";

import { createTemplateRemovedError, TEMPLATE_REMOVED_ERROR_CODE } from "./template-removed-error";

describe(createTemplateRemovedError.name, () => {
  it("answers 410 with the error code and the title the template had", () => {
    const error = createTemplateRemovedError("Llama 3.1 Chat");

    expect(error).toMatchObject({
      status: 410,
      message: "This template was removed",
      errorCode: "template_removed",
      data: { title: "Llama 3.1 Chat" }
    });
    expect(TEMPLATE_REMOVED_ERROR_CODE).toBe("template_removed");
  });
});
