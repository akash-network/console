import { describe, expect, it } from "vitest";

import { ApiError, extractApiErrorCode, extractApiErrorMessage, isApiError } from "./errors";

describe("ApiError", () => {
  it("captures status, body, and message", () => {
    const err = new ApiError(404, { msg: "not found" }, "GET /x → 404");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ msg: "not found" });
    expect(err.message).toBe("GET /x → 404");
  });
});

describe("isApiError", () => {
  it.each([
    ["ApiError instance", new ApiError(400, {}, "x"), true],
    ["plain Error", new Error("nope"), false],
    ["null", null, false],
    ["string", "boom", false],
    ["object lookalike", { status: 400, body: {} }, false]
  ])("%s → %s", (_label, input, expected) => {
    expect(isApiError(input)).toBe(expected);
  });
});

describe("extractApiErrorMessage", () => {
  it.each([
    ["NestJS-shaped body", new ApiError(400, { statusCode: 400, message: "Bad input", error: "Bad Request" }, "POST /x → 400"), "Bad input"],
    ["body with empty message", new ApiError(400, { message: "" }, "POST /x → 400"), ""],
    ["body without message", new ApiError(404, { detail: "missing" }, "GET /x → 404"), null],
    ["non-string message", new ApiError(400, { message: 42 }, "POST /x → 400"), null],
    ["string body", new ApiError(500, "internal error", "GET /x → 500"), null],
    ["null body", new ApiError(204, null, "DELETE /x → 204"), null],
    ["non-ApiError input", new Error("plain"), null]
  ])("%s", (_label, input, expected) => {
    expect(extractApiErrorMessage(input)).toBe(expected);
  });
});

describe("extractApiErrorCode", () => {
  it.each([
    ["body with code", new ApiError(400, { code: "RESOURCE_NOT_FOUND", message: "x" }, "POST /x → 400"), "RESOURCE_NOT_FOUND"],
    ["body with empty code", new ApiError(400, { code: "" }, "POST /x → 400"), ""],
    ["body without code", new ApiError(404, { message: "missing" }, "GET /x → 404"), null],
    ["non-string code", new ApiError(400, { code: 7 }, "POST /x → 400"), null],
    ["string body", new ApiError(500, "internal error", "GET /x → 500"), null],
    ["null body", new ApiError(204, null, "DELETE /x → 204"), null],
    ["non-ApiError input", new Error("plain"), null]
  ])("%s", (_label, input, expected) => {
    expect(extractApiErrorCode(input)).toBe(expected);
  });
});
