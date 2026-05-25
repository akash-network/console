import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { ManifestErrorSnackbar } from "./ManifestErrorSnackbar";

import { render, screen } from "@testing-library/react";

describe(ManifestErrorSnackbar.name, () => {
  it("renders message from provider for 400 error with message", () => {
    const err = createAxiosError(400, { message: "Bad Request" });
    setup({ err });

    expect(screen.queryByText(/Bad Request/)).toBeInTheDocument();
  });

  it("renders text response from provider for 400 error with message", () => {
    const err = createAxiosError(400, "Bad manifest format");
    setup({ err });

    expect(screen.queryByText(/Bad manifest format/)).toBeInTheDocument();
  });

  it("renders default error message if provider returns nothing for 400 error", () => {
    const err = createAxiosError(400, "");
    setup({ err });

    expect(screen.queryByText(/Something went wrong/)).toBeInTheDocument();
  });

  it("renders stringified response if provider returns non-string data for 400 error", () => {
    const err = createAxiosError(400, { foo: "bar" });
    setup({ err });

    expect(screen.queryByText(/{"foo":"bar"}/)).toBeInTheDocument();
  });

  it("renders custom error message when provided in messages prop", () => {
    const err = createAxiosError(400, {
      error: {
        issues: [{ path: ["custom", "path"], params: { reason: "customReason" } }]
      }
    });
    const messages = { "custom.path.customReason": "Custom error message" };
    setup({ err, messages });

    expect(screen.queryByText(/Custom error message/)).toBeInTheDocument();
  });

  it("renders default error message for unknown 400 issue", () => {
    const err = createAxiosError(400, {
      error: {
        issues: [{ path: ["unknown"], params: { reason: "unknownReason" } }]
      }
    });
    setup({ err });

    expect(screen.queryByText(/Something went wrong/)).toBeInTheDocument();
  });

  it("renders unique errors only for multiple identical issues", () => {
    const messages = { "custom.path.dup": "Duplicate issue" };
    const err = createAxiosError(400, {
      error: {
        issues: [
          { path: ["custom", "path"], params: { reason: "dup" } },
          { path: ["custom", "path"], params: { reason: "dup" } }
        ]
      }
    });
    const { container } = setup({ err, messages });

    const matches = container.textContent?.match(/Duplicate issue/g);
    expect(matches).toHaveLength(1);
  });

  it("renders multiple different errors for 400 with multiple issues", () => {
    const messages = {
      "custom.path.first": "First issue",
      "custom.path.second": "Second issue"
    };
    const err = createAxiosError(400, {
      error: {
        issues: [
          { path: ["custom", "path"], params: { reason: "first" } },
          { path: ["custom", "path"], params: { reason: "second" } }
        ]
      }
    });
    setup({ err, messages });

    expect(screen.queryByText(/First issue/)).toBeInTheDocument();
    expect(screen.queryByText(/Second issue/)).toBeInTheDocument();
  });

  it("renders string response data for 422 error", () => {
    const err = createAxiosError(422, "Provider returned an error");
    setup({ err });

    expect(screen.queryByText(/Provider returned an error/)).toBeInTheDocument();
  });

  it("renders message from response data object for 422 error", () => {
    const err = createAxiosError(422, { message: "Manifest validation failed" });
    setup({ err });

    expect(screen.queryByText(/Manifest validation failed/)).toBeInTheDocument();
  });

  it("renders JSON stringified response for 422 error without message", () => {
    const err = createAxiosError(422, { code: "INVALID_MANIFEST" });
    setup({ err });

    expect(screen.queryByText(/INVALID_MANIFEST/)).toBeInTheDocument();
  });

  it("renders raw error for non-HTTP errors", () => {
    const err = "Some raw error";
    setup({ err });

    expect(screen.queryByText(/Some raw error/)).toBeInTheDocument();
  });

  it("renders exception message for non-HTTP errors", () => {
    const err = new Error("Some exception occurred");
    setup({ err });

    expect(screen.queryByText(/Some exception occurred/)).toBeInTheDocument();
  });

  it("renders error title", () => {
    setup({ err: "test" });

    expect(screen.queryByText("Error")).toBeInTheDocument();
  });

  it("renders error prefix in subtitle", () => {
    setup({ err: "test" });

    expect(screen.queryByText(/Error while sending manifest to provider/)).toBeInTheDocument();
  });

  function setup(input: TestInput) {
    return render(<ManifestErrorSnackbar err={input.err} messages={input.messages} />);
  }

  interface TestInput {
    err: unknown;
    messages?: Record<string, string>;
  }
});

function createAxiosError<T>(status: number, data?: T): AxiosError<T> {
  const error = new AxiosError<T>("Request failed", AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: data as T
  });
  return error;
}
