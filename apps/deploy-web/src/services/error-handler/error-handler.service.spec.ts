import type { InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";

import { ErrorHandlerService } from "./error-handler.service";

describe(ErrorHandlerService.name, () => {
  it("handles generic error without extra metadata", () => {
    const captureException = jest.fn().mockReturnValue("event-id-1");
    const errorHandler = setup({ captureException });
    const error = new Error("Generic error");

    errorHandler.handleError(error);

    expect(captureException).toHaveBeenCalledWith(error, {
      extra: {},
      tags: {}
    });
  });

  it("handles HTTP error with response metadata", () => {
    const captureException = jest.fn().mockReturnValue("event-id-2");
    const errorHandler = setup({ captureException });

    const config = {
      method: "get",
      url: "https://api.example.com/users"
    } as InternalAxiosRequestConfig;
    const httpError = new AxiosError(
      "Request failed",
      "400",
      config,
      {},
      {
        status: 404,
        statusText: "Not Found",
        headers: {
          "content-type": "application/json",
          "x-request-id": "123-456-789"
        },
        data: {},
        config: config
      }
    );

    errorHandler.handleError(httpError);

    expect(captureException).toHaveBeenCalledWith(httpError, {
      extra: {
        headers: {
          "content-type": "application/json",
          "x-request-id": "123-456-789"
        }
      },
      tags: {
        status: "404",
        method: "GET",
        url: "https://api.example.com/users"
      }
    });
  });

  function setup(input?: { captureException?: (error: unknown, context?: any) => string }) {
    const captureException = input?.captureException || jest.fn().mockReturnValue("mock-event-id");
    return new ErrorHandlerService(captureException);
  }
});
