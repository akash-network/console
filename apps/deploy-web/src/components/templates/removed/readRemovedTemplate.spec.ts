import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { readRemovedTemplate } from "./readRemovedTemplate";

describe(readRemovedTemplate.name, () => {
  it("reads the title of a removed template", () => {
    const error = new ApiError(410, { code: "template_removed", message: "This template was removed", data: { title: "Open WebUI + vLLM" } }, "410");

    expect(readRemovedTemplate(error)).toEqual({ title: "Open WebUI + vLLM" });
  });

  it.each([
    ["no data", { code: "template_removed" }],
    ["data that is not an object", { code: "template_removed", data: "Open WebUI" }],
    ["data without a title", { code: "template_removed", data: {} }],
    ["a title that is not text", { code: "template_removed", data: { title: 7 } }],
    ["a blank title", { code: "template_removed", data: { title: "   " } }]
  ])("reads a removed template with %s as one without a title", (_, body) => {
    expect(readRemovedTemplate(new ApiError(410, body, "410"))).toEqual({ title: undefined });
  });

  it.each([
    ["a 410 with another code", new ApiError(410, { code: "gone", data: { title: "Open WebUI" } }, "410")],
    ["a 410 without a body", new ApiError(410, null, "410")],
    ["a 410 with a text body", new ApiError(410, "template_removed", "410")],
    ["a 404 carrying the code", new ApiError(404, { code: "template_removed", data: { title: "Open WebUI" } }, "404")],
    ["a server error", new ApiError(503, { message: "Unavailable" }, "503")],
    ["a network failure", new TypeError("Failed to fetch")],
    ["no error", null]
  ])("has nothing to say about %s", (_, error) => {
    expect(readRemovedTemplate(error)).toBeUndefined();
  });
});
