import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { FORK_REFUSAL_MESSAGES, readForkRefusal } from "./readForkRefusal";

describe(readForkRefusal.name, () => {
  it("reads a removed source", () => {
    expect(readForkRefusal(new ApiError(410, { code: "template_removed", data: { title: "Open WebUI" } }, "POST → 410"))).toBe("source_removed");
  });

  it("reads a source the caller can no longer open", () => {
    expect(readForkRefusal(new ApiError(404, { message: "Template not found" }, "POST → 404"))).toBe("source_unreadable");
  });

  it.each([400, 401, 403, 409, 429, 500])("leaves a %i to the other readers", status => {
    expect(readForkRefusal(new ApiError(status, { code: "template_rate_limited", message: "Slow down" }, `POST → ${status}`))).toBeUndefined();
  });

  it("does not take a 410 without the removed code for a removed source", () => {
    expect(readForkRefusal(new ApiError(410, { code: "gone" }, "POST → 410"))).toBeUndefined();
  });

  it("reads nothing from an error that is not the API's", () => {
    expect(readForkRefusal(new Error("network down"))).toBeUndefined();
    expect(readForkRefusal(undefined)).toBeUndefined();
  });

  it("words each refusal for the person saving the copy", () => {
    expect(FORK_REFUSAL_MESSAGES).toEqual({
      source_removed: "The template you forked was removed, so a copy of it can't be saved.",
      source_unreadable: "You can no longer open the template you forked, so a copy of it can't be saved."
    });
  });
});
