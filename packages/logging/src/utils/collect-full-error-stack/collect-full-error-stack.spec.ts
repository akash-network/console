import { collectFullErrorStack, ErrorWithCause } from "./collect-full-error-stack";

describe(collectFullErrorStack.name, () => {
  it("returns empty string for falsy value", () => {
    expect(collectFullErrorStack(undefined)).toBe("");
    expect(collectFullErrorStack(null)).toBe("");
  });

  it("returns basic stack", () => {
    const error = new Error("test error");
    const result = collectFullErrorStack(error);
    expect(result).toBe(error.stack);
  });

  it("returns error stacktrace with its cause stacktrace", () => {
    const causeError = new Error("cause error");
    const mainError = new Error("main error");
    (mainError as unknown as ErrorWithCause).cause = causeError;

    const result = collectFullErrorStack(mainError);

    expect(result).toContain("main error");
    expect(result).toContain("Caused by:");
    expect(result).toContain("cause error");
  });

  it("returns nested causes stacktrace", () => {
    const deepError = new Error("deep error");
    const middleError = new Error("middle error");
    const topError = new Error("top error");

    (middleError as unknown as ErrorWithCause).cause = deepError;
    (topError as unknown as ErrorWithCause).cause = middleError;

    const result = collectFullErrorStack(topError);

    expect(result).toContain("top error");
    expect(result).toContain("middle error");
    expect(result).toContain("deep error");
    expect(result.match(/Caused by:/g)?.length).toBe(2);
  });

  it("returns error array stacktrace", () => {
    const error1 = new Error("error 1");
    const error2 = new Error("error 2");
    const mainError = new Error("main error");
    (mainError as unknown as ErrorWithCause).errors = [error1, error2];

    const result = collectFullErrorStack(mainError);

    expect(result).toContain("main error");
    expect(result).toContain("Errors:");
    expect(result).toContain("error 1");
    expect(result).toContain("error 2");
  });

  it("returns stacktrace with indent", () => {
    const error = new Error("test error");
    const result = collectFullErrorStack(error, 2);

    const lines = result.split("\n");
    lines.forEach(line => {
      expect(line).toMatch(/^ {2}/);
    });
  });

  it("returns cause and errors array stacktraces", () => {
    const causeError = new Error("cause error");
    const error1 = new Error("error 1");
    const error2 = new Error("error 2");
    const mainError = new Error("main error");

    (mainError as unknown as ErrorWithCause).cause = causeError;
    (mainError as unknown as ErrorWithCause).errors = [error1, error2];

    const result = collectFullErrorStack(mainError);

    expect(result).toContain("main error");
    expect(result).toContain("Caused by:\n  Error: cause error");
    expect(result).toContain("Errors:");
    expect(result).toContain("error 1");
    expect(result).toContain("error 2");
  });
});
