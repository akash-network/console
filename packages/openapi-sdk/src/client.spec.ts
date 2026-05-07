import { describe, expect, it, vi } from "vitest";

import { createClient } from "./client";
import { ApiError } from "./errors";

const operations = {
  v1: {
    getThing: { path: "/v1/things/{id}", method: "get", operationId: "getThing", pathParams: ["id"], queryParams: [], hasBody: false },
    listThings: { path: "/v1/things", method: "get", operationId: "listThings", pathParams: [], queryParams: ["page", "limit"], hasBody: false },
    createThing: { path: "/v1/things", method: "post", operationId: "createThing", pathParams: [], queryParams: [], hasBody: true },
    deleteThing: { path: "/v1/things/{id}", method: "delete", operationId: "deleteThing", pathParams: ["id"], queryParams: [], hasBody: false }
  }
} as const;

type TestPaths = {
  "/v1/things/{id}": {
    get: {
      parameters: { path: { id: number }; query?: never; header?: never };
      responses: { 200: { content: { "application/json": { id: number } } } };
    };
    delete: {
      parameters: { path: { id: number }; query?: never; header?: never };
      responses: { 200: { content: { "application/json": unknown } } };
    };
  };
  "/v1/things": {
    get: {
      parameters: { path?: never; query: { page?: number; limit?: number }; header?: never };
      responses: { 200: { content: { "application/json": { items: number[] } } } };
    };
    post: {
      parameters: { path?: never; query?: never; header?: never };
      requestBody: { content: { "application/json": { name: string } } };
      responses: { 201: { content: { "application/json": { id: number } } } };
    };
  };
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("createClient", () => {
  it("substitutes path params from the flat input", async () => {
    const { client, fetchMock } = setup({ response: jsonResponse(200, { id: 7 }) });

    const result = await client.v1.getThing({ id: 7 });

    expect(result).toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api/v1/things/7");
    expect(init.method).toBe("GET");
  });

  it("does not set content-type on bodyless requests", async () => {
    const { client, fetchMock } = setup();

    await client.v1.getThing({ id: 1 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
    expect(init.headers["content-type"]).toBeUndefined();
  });

  it("sets content-type to application/json when sending a body", async () => {
    const { client, fetchMock } = setup({ response: jsonResponse(201, {}) });

    await client.v1.createThing({ name: "abc" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["content-type"]).toBe("application/json");
  });

  it("does not override caller-supplied content-type", async () => {
    const { client, fetchMock } = setup({ response: jsonResponse(201, {}) });

    await client.v1.createThing({ name: "abc" }, { headers: { "Content-Type": "application/vnd.custom+json" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["content-type"]).toBeUndefined();
    expect(init.headers["Content-Type"]).toBe("application/vnd.custom+json");
  });

  it("routes flat-input keys to the URL query string for GET ops", async () => {
    const { client, fetchMock } = setup({ response: jsonResponse(200, { items: [] }) });

    await client.v1.listThings({ page: 2, limit: 10 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api/v1/things?page=2&limit=10");
  });

  it("merges defaultHeaders with options.headers", async () => {
    const { client, fetchMock } = setup({ defaultHeaders: { "x-default": "1", "content-type": "application/json" } });

    await client.v1.getThing({ id: 1 }, { headers: { "x-call": "2" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({ "x-default": "1", "x-call": "2", "content-type": "application/json" });
  });

  it("serializes flat input as JSON body for ops declaring hasBody", async () => {
    const { client, fetchMock } = setup({ response: jsonResponse(201, { id: 7 }) });

    await client.v1.createThing({ name: "abc" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "abc" }));
  });

  it("throws ApiError with parsed JSON body on non-2xx", async () => {
    const { client } = setup({ response: jsonResponse(404, { msg: "missing" }) });

    await expect(client.v1.getThing({ id: 7 })).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      body: { msg: "missing" }
    });
    await expect(client.v1.getThing({ id: 7 })).rejects.toBeInstanceOf(ApiError);
  });

  it("returns text when content-type is not JSON", async () => {
    const { client } = setup({
      response: new Response("plain text", { status: 200, headers: { "content-type": "text/plain" } })
    });

    expect(await client.v1.getThing({ id: 1 })).toBe("plain text");
  });

  it("forwards AbortSignal from options", async () => {
    const { client, fetchMock } = setup();
    const ac = new AbortController();

    await client.v1.getThing({ id: 1 }, { signal: ac.signal });

    expect(fetchMock.mock.calls[0][1].signal).toBe(ac.signal);
  });

  it("returns undefined for unknown operation", () => {
    const { client } = setup();

    expect((client.v1 as Record<PropertyKey, unknown>).nope).toBeUndefined();
  });

  it("group objects are not thenable", async () => {
    const { client } = setup();
    const v1 = client.v1 as Record<PropertyKey, unknown>;

    expect(v1.then).toBeUndefined();
    // await on a non-thenable value should resolve to the value itself
    await expect(Promise.resolve(v1)).resolves.toBe(v1);
  });

  it("returns undefined for symbol property access on a group", () => {
    const { client } = setup();

    expect((client.v1 as Record<PropertyKey, unknown>)[Symbol.iterator]).toBeUndefined();
  });

  it("client root is not thenable", async () => {
    const { client } = setup();
    const rootClient = client as Record<PropertyKey, unknown>;

    expect(rootClient.then).toBeUndefined();
    await expect(Promise.resolve(rootClient)).resolves.toBe(rootClient);
  });

  function setup(input: { response?: Response; defaultHeaders?: Record<string, string> } = {}) {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve((input.response ?? jsonResponse(200, {})).clone()));
    const client = createClient<TestPaths, typeof operations>(operations, {
      baseUrl: "https://api",
      fetch: fetchMock,
      defaultHeaders: input.defaultHeaders
    });
    return { client, fetchMock };
  }
});
