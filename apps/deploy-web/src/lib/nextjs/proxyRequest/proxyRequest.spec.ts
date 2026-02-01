import type { NextApiRequest, NextApiResponse } from "next";
import { EventEmitter, Readable, Writable } from "node:stream";

import { proxyRequest } from "./proxyRequest";

interface MockFetchOptions {
  method?: string;
  headers?: Headers;
  body?: ReadableStream<Uint8Array>;
  duplex?: "half";
  signal?: AbortSignal;
}

describe(proxyRequest.name, () => {
  describe("when request succeeds", () => {
    it("forwards request to target and streams response back", async () => {
      const { res, mockFetch } = await setup({
        fetchResponse: {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          body: null
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://target.com/api",
        expect.objectContaining({
          method: "GET",
          signal: expect.any(AbortSignal)
        })
      );
      expect(res.writeHead).toHaveBeenCalledWith(200, { "content-type": "application/json" });
      expect(res.end).toHaveBeenCalled();
    });

    it("forwards POST request with body", async () => {
      const requestBody = "request body";
      const { mockFetch } = await setup({
        method: "POST",
        requestBody,
        fetchResponse: {
          status: 201,
          headers: new Headers(),
          body: createReadableStream("created")
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://target.com/api",
        expect.objectContaining({
          method: "POST",
          body: expect.anything(),
          duplex: "half"
        })
      );
    });

    it("does not include body for GET requests", async () => {
      const { mockFetch } = await setup({
        method: "GET",
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://target.com/api",
        expect.objectContaining({
          method: "GET",
          body: undefined,
          duplex: undefined
        })
      );
    });

    it("does not include body for HEAD requests", async () => {
      const { mockFetch } = await setup({
        method: "HEAD",
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://target.com/api",
        expect.objectContaining({
          method: "HEAD",
          body: undefined,
          duplex: undefined
        })
      );
    });

    it("ends response when upstream returns no body", async () => {
      const { res } = await setup({
        fetchResponse: {
          status: 204,
          headers: new Headers(),
          body: null
        }
      });

      expect(res.end).toHaveBeenCalled();
    });

    it("streams response body when present", async () => {
      const { res } = await setup({
        fetchResponse: {
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          body: createReadableStream("streamed content")
        }
      });

      expect(res.writeHead).toHaveBeenCalledWith(200, { "content-type": "text/plain" });
    });
  });

  describe("when handling headers", () => {
    it("forwards request headers except host, connection, and cookie", async () => {
      const { mockFetch } = await setup({
        reqHeaders: {
          host: "localhost:3000",
          connection: "keep-alive",
          cookie: "session=abc",
          "content-type": "application/json",
          authorization: "Bearer token"
        },
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      const passedHeaders = mockFetch.mock.calls[0]![1]!.headers!;
      expect(passedHeaders.has("host")).toBe(false);
      expect(passedHeaders.has("connection")).toBe(false);
      expect(passedHeaders.has("cookie")).toBe(false);
      expect(passedHeaders.get("content-type")).toBe("application/json");
      expect(passedHeaders.get("authorization")).toBe("Bearer token");
    });

    it("filters hop-by-hop headers from request", async () => {
      const { mockFetch } = await setup({
        reqHeaders: {
          "transfer-encoding": "chunked",
          "proxy-connection": "keep-alive",
          "keep-alive": "timeout=5",
          te: "trailers",
          trailer: "Expires",
          upgrade: "websocket",
          "proxy-authenticate": "Basic",
          "proxy-authorization": "Basic abc",
          "x-custom-header": "value"
        },
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      const passedHeaders = mockFetch.mock.calls[0]![1]!.headers!;
      expect(passedHeaders.has("transfer-encoding")).toBe(false);
      expect(passedHeaders.has("proxy-connection")).toBe(false);
      expect(passedHeaders.has("keep-alive")).toBe(false);
      expect(passedHeaders.has("te")).toBe(false);
      expect(passedHeaders.has("trailer")).toBe(false);
      expect(passedHeaders.has("upgrade")).toBe(false);
      expect(passedHeaders.has("proxy-authenticate")).toBe(false);
      expect(passedHeaders.has("proxy-authorization")).toBe(false);
      expect(passedHeaders.get("x-custom-header")).toBe("value");
    });

    it("appends array header values", async () => {
      const { mockFetch } = await setup({
        reqHeaders: {
          "accept-encoding": ["gzip", "deflate"]
        },
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      const passedHeaders = mockFetch.mock.calls[0]![1]!.headers!;
      expect(passedHeaders.get("accept-encoding")).toBe("gzip, deflate");
    });

    it("merges custom headers with request headers", async () => {
      const { mockFetch } = await setup({
        reqHeaders: {
          "x-original": "original",
          "x-custom": "request-value"
        },
        customHeaders: {
          "x-custom": "custom-value"
        },
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      const passedHeaders = mockFetch.mock.calls[0]![1]!.headers!;
      expect(passedHeaders.get("x-original")).toBe("original");
      expect(passedHeaders.get("x-custom")).toBe("custom-value");
    });

    it("filters hop-by-hop headers from response", async () => {
      const { res } = await setup({
        fetchResponse: {
          status: 200,
          headers: new Headers({
            "content-type": "application/json",
            "transfer-encoding": "chunked",
            connection: "keep-alive"
          }),
          body: null
        }
      });

      expect(res.writeHead).toHaveBeenCalledWith(200, {
        "content-type": "application/json"
      });
    });
  });

  describe("when request fails", () => {
    it("returns 502 when fetch fails before headers are sent", async () => {
      const { res } = await setup({
        fetchError: new Error("Connection refused")
      });

      expect(res.statusCode).toBe(502);
      expect(res.endData).toBe(JSON.stringify({ error: "Proxy error" }));
    });

    it("destroys response when error occurs after headers are sent", async () => {
      const { res } = await setup({
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: createFailingStream(new Error("Stream error"))
        }
      });

      expect(res.destroy).toHaveBeenCalled();
    });
  });

  describe("when client disconnects", () => {
    it("returns 499 when request is aborted", async () => {
      const { res } = await setup({
        abortRequest: true,
        fetchDelay: 100
      });

      expect(res.statusCode).toBe(499);
      expect(res.endData).toBe(JSON.stringify({ error: "Proxy error" }));
    });

    it("returns 499 when response closes", async () => {
      const { res } = await setup({
        closeResponse: true,
        fetchDelay: 100
      });

      expect(res.statusCode).toBe(499);
      expect(res.endData).toBe(JSON.stringify({ error: "Proxy error" }));
    });
  });

  describe("when handling timeout", () => {
    it("uses default timeout of 60 seconds", async () => {
      const { mockFetch } = await setup({
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      const signal = mockFetch.mock.calls[0]![1]!.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it("uses custom timeout when provided", async () => {
      const { mockFetch } = await setup({
        timeout: 5000,
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      const signal = mockFetch.mock.calls[0]![1]!.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("when custom signal is provided", () => {
    it("combines custom signal with internal signals", async () => {
      const externalController = new AbortController();
      const { mockFetch } = await setup({
        signal: externalController.signal,
        fetchResponse: {
          status: 200,
          headers: new Headers(),
          body: null
        }
      });

      const passedSignal = mockFetch.mock.calls[0]![1]!.signal;
      expect(passedSignal).not.toBe(externalController.signal);
      expect(passedSignal).toBeInstanceOf(AbortSignal);
    });

    it("aborts when external signal is aborted", async () => {
      const externalController = new AbortController();
      const { res } = await setup({
        signal: externalController.signal,
        fetchDelay: 100,
        abortExternalSignal: externalController
      });

      expect(res.statusCode).toBe(499);
    });
  });

  function setup(input: {
    method?: string;
    requestBody?: string;
    reqHeaders?: Record<string, string | string[] | undefined>;
    customHeaders?: HeadersInit;
    fetchResponse?: {
      status: number;
      headers: Headers;
      body: ReadableStream<Uint8Array> | null;
    };
    fetchError?: Error;
    fetchDelay?: number;
    timeout?: number;
    signal?: AbortSignal;
    abortRequest?: boolean;
    closeResponse?: boolean;
    abortExternalSignal?: AbortController;
  }) {
    const reqEmitter = new EventEmitter();
    const resEmitter = new EventEmitter();

    const req = Object.assign(reqEmitter, {
      method: input.method ?? "GET",
      headers: input.reqHeaders ?? {},
      pipe: jest.fn()
    }) as unknown as NextApiRequest;

    if (input.requestBody) {
      const readable = Readable.from([input.requestBody]);
      Object.assign(req, readable);
    } else {
      const readable = Readable.from([]);
      Object.assign(req, readable);
    }

    let writtenData = "";
    let endData: string | undefined;

    const writableStream = new Writable({
      write(chunk, _encoding, callback) {
        writtenData += chunk.toString();
        callback();
      }
    });

    const res = Object.assign(resEmitter, writableStream, {
      statusCode: 200,
      headersSent: false,
      writeHead: jest.fn(function (this: { headersSent: boolean }) {
        this.headersSent = true;
      }),
      end: jest.fn((data?: string) => {
        endData = data;
      }),
      destroy: jest.fn(),
      writtenData: "",
      endData: undefined as string | undefined
    }) as unknown as NextApiResponse & {
      writtenData: string;
      endData: string | undefined;
    };

    Object.defineProperty(res, "writtenData", {
      get: () => writtenData
    });
    Object.defineProperty(res, "endData", {
      get: () => endData
    });

    const mockFetch = jest.fn(async (_url: string, options?: MockFetchOptions) => {
      if (input.fetchDelay) {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(resolve, input.fetchDelay);
          options?.signal?.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            reject(options?.signal?.reason ?? new Error("aborted"));
          });
        });
      }

      if (input.fetchError) {
        throw input.fetchError;
      }

      return {
        status: input.fetchResponse?.status ?? 200,
        headers: input.fetchResponse?.headers ?? new Headers(),
        body: input.fetchResponse?.body
      };
    });

    const promise = proxyRequest(req, res, {
      target: "http://target.com/api",
      timeout: input.timeout,
      signal: input.signal,
      headers: input.customHeaders,
      fetch: mockFetch as unknown as typeof globalThis.fetch
    });

    if (input.abortRequest) {
      setImmediate(() => reqEmitter.emit("aborted"));
    }

    if (input.closeResponse) {
      setImmediate(() => resEmitter.emit("close"));
    }

    if (input.abortExternalSignal) {
      setImmediate(() => input.abortExternalSignal?.abort());
    }

    return promise.then(() => ({ req, res, mockFetch }));
  }
});

function createReadableStream(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    }
  });
}

function createFailingStream(error: Error): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.error(error);
    }
  });
}
