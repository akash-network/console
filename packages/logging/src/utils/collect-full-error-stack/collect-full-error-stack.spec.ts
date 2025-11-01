import { collectFullErrorStack } from "./collect-full-error-stack";

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
    mainError.cause = causeError;

    const result = collectFullErrorStack(mainError);

    expect(result).toContain("main error");
    expect(result).toContain("Caused by:");
    expect(result).toContain("cause error");
  });

  it("returns nested causes stacktrace", () => {
    const deepError = new Error("deep error");
    const middleError = new Error("middle error");
    const topError = new Error("top error");

    middleError.cause = deepError;
    topError.cause = middleError;

    const result = collectFullErrorStack(topError);

    expect(result).toContain("top error");
    expect(result).toContain("middle error");
    expect(result).toContain("deep error");
    expect(result.match(/Caused by:/g)?.length).toBe(2);
  });

  it("returns error array stacktrace", () => {
    const error1 = new Error("error 1");
    const error2 = new Error("error 2");
    const mainError = new AggregateError([error1, error2], "main error");

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
    const mainError = new AggregateError([error1, error2], "main error");

    mainError.cause = causeError;

    const result = collectFullErrorStack(mainError);

    expect(result).toContain("main error");
    expect(result).toContain("Caused by:\n  Error: cause error");
    expect(result).toContain("Errors:");
    expect(result).toContain("error 1");
    expect(result).toContain("error 2");
  });

  it("collects response/request full info", () => {
    const error = new Error("test error");
    Object.assign(error, {
      response: {
        status: 400,
        data: { message: "Fatal error" },
        config: {
          url: "https://api.example.com/resource",
          method: "GET"
        }
      }
    });

    const result = collectFullErrorStack(error);
    expect(result).toContain("test error");
    expect(result).toContain("Status: 400");
    expect(result).toContain("Request: GET https://api.example.com/resource");
    expect(result).toContain("Error: Fatal error");
  });

  it("collects response/request partial info", () => {
    const error = new Error("test error");
    Object.assign(error, {
      response: {
        status: 400
      }
    });

    const result = collectFullErrorStack(error);
    expect(result).toContain("test error");
    expect(result).toContain("Status: 400");
    expect(result).toContain("Request: Unknown request");
    expect(result).toContain("Error: Not specified");
  });

  it("collects code from error", () => {
    const error = new Error("test error");
    Object.assign(error, { code: "TEST_ERROR" });
    const result = collectFullErrorStack(error);
    expect(result).toContain("test error (code: TEST_ERROR)");
  });

  it("returns sanitized string for string input", () => {
    const result = collectFullErrorStack("Log: \rl�dqz\u0015M�J�\t���\\�ͺ� does not allow");
    expect(result).toBe("Log: \\rl\\uFFFD+dqz\\u0015M\\uFFFD+J\\uFFFD+\\t\\uFFFD+\\\\uFFFD+ͺ\\uFFFD+ does not allow");
  });
});
