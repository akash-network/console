import { ERROR_MESSAGES, parseApiError } from "./apiErrors";

describe("parseApiError", () => {
  it("falls back to a generic message when error is not an Axios-shaped object", () => {
    const result = parseApiError(new Error("boom"));
    expect(result.message).toBe("An error occurred while processing your request. Please try again.");
    expect(result.code).toBeUndefined();
    expect(result.rootError).toBeUndefined();
    expect(result.fieldErrors).toEqual({});
  });

  it("returns the API message when detail.error is present", () => {
    const result = parseApiError({
      response: {
        data: {
          detail: {
            error: { message: "Wallet already imported", error_code: "WAL_007" }
          }
        }
      }
    });
    expect(result.message).toBe("Wallet already imported");
    expect(result.code).toBe("WAL_007");
  });

  it("maps a known cert-manager validation error code to a friendly message", () => {
    const result = parseApiError({
      response: {
        data: {
          detail: {
            error: { error_code: "VAL_006" }
          }
        }
      }
    });
    expect(result.message).toBe(ERROR_MESSAGES.VAL_006);
    expect(result.code).toBe("VAL_006");
  });

  it("collects field-level validation errors from details[]", () => {
    const result = parseApiError({
      response: {
        data: {
          detail: {
            error: { error_code: "VAL_008" },
            details: [
              { field: "cert_manager.cloudflare.api_token", message: "Token is required" },
              { field: "domain", message: "Domain is required" }
            ]
          }
        }
      }
    });
    expect(result.fieldErrors).toEqual({
      "cert_manager.cloudflare.api_token": "Token is required",
      domain: "Domain is required"
    });
    expect(result.rootError).toBeUndefined();
  });

  it("treats details[].field === '__root__' as a form-level error", () => {
    const result = parseApiError({
      response: {
        data: {
          detail: {
            details: [{ field: "__root__", message: "dns_provider does not match payload shape" }]
          }
        }
      }
    });
    expect(result.rootError).toBe("dns_provider does not match payload shape");
    expect(result.fieldErrors).toEqual({});
  });

  it("joins multiple __root__ entries with newlines", () => {
    const result = parseApiError({
      response: {
        data: {
          detail: {
            details: [
              { field: "__root__", message: "first cross-field problem" },
              { field: "__root__", message: "second cross-field problem" }
            ]
          }
        }
      }
    });
    expect(result.rootError).toBe("first cross-field problem\nsecond cross-field problem");
  });

  it("falls back to the mapped error code message when no detail.error.message is present", () => {
    const result = parseApiError({
      response: {
        data: {
          detail: {
            error: { error_code: "PRV_009" }
          }
        }
      }
    });
    expect(result.message).toBe(ERROR_MESSAGES.PRV_009);
  });

  it("ignores malformed details entries", () => {
    const result = parseApiError({
      response: {
        data: {
          detail: {
            details: [{ field: "domain" }, { message: "stray message with no field" }, "not an object", null]
          }
        }
      }
    });
    expect(result.fieldErrors).toEqual({});
    expect(result.rootError).toBeUndefined();
  });
});
