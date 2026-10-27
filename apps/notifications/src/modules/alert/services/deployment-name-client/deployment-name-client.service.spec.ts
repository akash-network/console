import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock } from "vitest-mock-extended";

import { DeploymentNameClient } from "./deployment-name-client.service";

describe(DeploymentNameClient.name, () => {
  const READER = { userId: "5f0c7c1e-8a0b-4c55-9d4e-2b0f1d6e7a10", organizationId: "9b3e2d4a-1c6f-4e8b-a7d5-3f2c1b0e9d8a" };
  const READER_QUERY = `userId=${READER.userId}&organizationId=${READER.organizationId}`;

  it("asks console-api for the deployment's name with the internal token", async () => {
    const { client, received, token } = await setup({ respond: answerWith({ name: "my-app" }) });

    const name = await client.findName({ owner: "akash1owner", dseq: "4242", reader: READER });

    expect(name).toBe("my-app");
    expect(received).toEqual([{ method: "GET", url: `/internal/deployment-names/akash1owner/4242?${READER_QUERY}`, token }]);
  });

  it("names only the user of an alert filed in no organization", async () => {
    const { client, received } = await setup({ respond: answerWith({ name: null }) });

    await client.findName({ owner: "akash1owner", dseq: "4242", reader: { userId: READER.userId, organizationId: null } });

    expect(received.map(request => request.url)).toEqual([`/internal/deployment-names/akash1owner/4242?userId=${READER.userId}`]);
  });

  it("returns null for a deployment console-api holds no name for", async () => {
    const { client } = await setup({ respond: answerWith({ name: null }) });

    expect(await client.findName({ owner: "akash1owner", dseq: "4242", reader: READER })).toBeNull();
  });

  it("asks the same path when the console-api base url ends with slashes", async () => {
    const { client, received } = await setup({ baseUrlSuffix: "//", respond: answerWith({ name: null }) });

    await client.findName({ owner: "akash1owner", dseq: "4242", reader: READER });

    expect(received.map(request => request.url)).toEqual([`/internal/deployment-names/akash1owner/4242?${READER_QUERY}`]);
  });

  it("keeps the owner and dseq inside their own path segments", async () => {
    const { client, received } = await setup({ respond: answerWith({ name: null }) });

    await client.findName({ owner: "akash1owner/../x", dseq: "4242?y", reader: READER });

    expect(received.map(request => request.url)).toEqual([`/internal/deployment-names/akash1owner%2F..%2Fx/4242%3Fy?${READER_QUERY}`]);
  });

  it("fails with what console-api answered when it refuses the lookup", async () => {
    const { client } = await setup({
      respond: response => {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ message: "Invalid address" }));
      }
    });

    await expect(client.findName({ owner: "akash1owner", dseq: "4242", reader: READER })).rejects.toThrow(
      'console-api answered 400: {"message":"Invalid address"}'
    );
  });

  it("fails on a redirect instead of following it", async () => {
    const { client, received } = await setup({
      respond: (response, request) => {
        response.writeHead(307, { location: `${request.url}/elsewhere` });
        response.end();
      }
    });

    await expect(client.findName({ owner: "akash1owner", dseq: "4242", reader: READER })).rejects.toThrow("console-api answered 307");
    expect(received).toHaveLength(1);
  });

  it("fails on an answer that does not carry a name", async () => {
    const { client } = await setup({ respond: answerWith({ deployment: "my-app" }) });

    await expect(client.findName({ owner: "akash1owner", dseq: "4242", reader: READER })).rejects.toThrow();
  });

  it("gives up once console-api takes longer than the timeout to answer", async () => {
    const { client } = await setup({ timeoutMs: 50, respond: () => {} });

    await expect(client.findName({ owner: "akash1owner", dseq: "4242", reader: READER })).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it.each([
    ["the console-api base url", { baseUrl: undefined }],
    ["the internal token", { token: undefined }]
  ])("returns null without calling console-api when %s is not set", async (_, missing) => {
    const { client, received } = await setup(missing);

    expect(await client.findName({ owner: "akash1owner", dseq: "4242", reader: READER })).toBeNull();
    expect(received).toEqual([]);
  });

  function answerWith(body: unknown) {
    return (response: ServerResponse) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
  }

  async function setup(input: {
    baseUrl?: string;
    baseUrlSuffix?: string;
    token?: string;
    timeoutMs?: number;
    respond?: (response: ServerResponse, request: IncomingMessage) => void;
  }) {
    const received: Array<{ method?: string; url?: string; token?: string | string[] }> = [];
    const respond = input.respond ?? answerWith({ name: null });
    const server = createServer((request, response) => {
      received.push({ method: request.method, url: request.url, token: request.headers["x-console-internal-token"] });
      respond(response, request);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    onTestFinished(async () => {
      server.closeAllConnections();
      if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    });

    const token = faker.string.alphanumeric(32);
    const config: Record<string, unknown> = {
      "alert.CONSOLE_API_BASE_URL":
        "baseUrl" in input ? input.baseUrl : `http://127.0.0.1:${(server.address() as AddressInfo).port}${input.baseUrlSuffix ?? ""}`,
      "alert.CONSOLE_API_INTERNAL_TOKEN": "token" in input ? input.token : token,
      "alert.CONSOLE_API_TIMEOUT_MS": input.timeoutMs ?? 2000
    };
    const configService = mock<ConfigService>();
    configService.get.mockImplementation((key: string) => config[key]);
    configService.getOrThrow.mockImplementation((key: string) => config[key]);
    const module = await Test.createTestingModule({ providers: [DeploymentNameClient, { provide: ConfigService, useValue: configService }] }).compile();

    return { client: module.get(DeploymentNameClient), received, token };
  }
});
