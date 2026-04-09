import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import { handleLogsStreamError } from "./DeploymentLogs";

describe(handleLogsStreamError.name, () => {
  it("reports error as warning when signal is not aborted", () => {
    const { errorHandler, setIsLoadingLogs, setIsConnectionEstablished } = setup();
    const error = new Error("websocket error: 1006 unknown reason");

    handleLogsStreamError(error, AbortSignal.any([]), errorHandler, setIsLoadingLogs, setIsConnectionEstablished);

    expect(setIsLoadingLogs).toHaveBeenCalledWith(false);
    expect(setIsConnectionEstablished).toHaveBeenCalledWith(false);
    expect(errorHandler.reportError).toHaveBeenCalledWith({
      error,
      severity: "warning",
      tags: { category: "deployments", label: "followLogs" }
    });
  });

  it("skips reporting when signal is aborted", () => {
    const { errorHandler, setIsLoadingLogs, setIsConnectionEstablished } = setup();

    handleLogsStreamError(new Error("websocket error"), AbortSignal.abort(), errorHandler, setIsLoadingLogs, setIsConnectionEstablished);

    expect(setIsLoadingLogs).not.toHaveBeenCalled();
    expect(setIsConnectionEstablished).not.toHaveBeenCalled();
    expect(errorHandler.reportError).not.toHaveBeenCalled();
  });

  function setup() {
    const errorHandler = mock<ErrorHandlerService>();
    const setIsLoadingLogs = vi.fn();
    const setIsConnectionEstablished = vi.fn();
    return { errorHandler, setIsLoadingLogs, setIsConnectionEstablished };
  }
});
