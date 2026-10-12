import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, onTestFinished } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { ActivityFeedClient, type AlertActivity } from "./activity-feed-client.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(ActivityFeedClient.name, () => {
  it("posts the alert to console-api as an info activity, with the internal token", async () => {
    const { client, received, token } = await setup({});
    const activity = createAlertActivity({ dseq: "4242" });

    await client.addAlert(activity);

    expect(received).toEqual([
      {
        method: "POST",
        url: "/internal/activities",
        contentType: "application/json",
        token,
        body: { ...activity, status: "info" }
      }
    ]);
  });

  it("fails with what console-api answered when it refuses the alert", async () => {
    const { client } = await setup({
      respond: response => {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ message: "User not found" }));
      }
    });

    await expect(client.addAlert(createAlertActivity())).rejects.toThrow('console-api answered 404: {"message":"User not found"}');
  });

  it("gives up once console-api takes longer than the timeout to answer", async () => {
    const { client } = await setup({ timeoutMs: 50, respond: () => {} });

    await expect(client.addAlert(createAlertActivity())).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("fails when console-api cannot be reached", async () => {
    const { client, stop } = await setup({});
    await stop();

    await expect(client.addAlert(createAlertActivity())).rejects.toThrow("fetch failed");
  });

  it.each([
    ["the console-api base url", { baseUrl: undefined }],
    ["the internal token", { token: undefined }]
  ])("fails without calling console-api when %s is not set", async (_, missing) => {
    const { client, received } = await setup(missing);

    await expect(client.addAlert(createAlertActivity())).rejects.toThrow(
      "CONSOLE_API_BASE_URL and CONSOLE_API_INTERNAL_TOKEN must both be set to write to the activity feed"
    );
    expect(received).toEqual([]);
  });

  function createAlertActivity(meta: { dseq?: string } = {}): AlertActivity {
    const alertId = faker.string.uuid();

    return {
      userId: faker.string.uuid(),
      type: "deployment_reclaim_alert",
      dedupeKey: `deployment_reclaim_alert.${alertId}`,
      meta: { alertId, summary: "Deployment 4242 is being reclaimed by the provider", ...meta }
    };
  }

  async function setup(input: {
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    respond?: (response: ServerResponse, request: IncomingMessage) => void;
  }) {
    const received: Array<{ method?: string; url?: string; contentType?: string; token?: string | string[]; body: unknown }> = [];
    const respond =
      input.respond ??
      ((response: ServerResponse) => {
        response.writeHead(204);
        response.end();
      });
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      received.push({
        method: request.method,
        url: request.url,
        contentType: request.headers["content-type"],
        token: request.headers["x-console-internal-token"],
        body: JSON.parse(Buffer.concat(chunks).toString())
      });
      respond(response, request);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const stop = () => new Promise<void>(resolve => server.close(() => resolve()));
    onTestFinished(async () => {
      server.closeAllConnections();
      if (server.listening) await stop();
    });

    const token = faker.string.alphanumeric(32);
    const config: Record<string, unknown> = {
      "notifications.CONSOLE_API_BASE_URL": "baseUrl" in input ? input.baseUrl : `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      "notifications.CONSOLE_API_INTERNAL_TOKEN": "token" in input ? input.token : token,
      "notifications.CONSOLE_API_TIMEOUT_MS": input.timeoutMs ?? 2000
    };
    const module = await Test.createTestingModule({ providers: [ActivityFeedClient, MockProvider(ConfigService)] }).compile();
    const configService = module.get<MockProxy<ConfigService>>(ConfigService);
    configService.get.mockImplementation((key: string) => config[key]);
    configService.getOrThrow.mockImplementation((key: string) => config[key]);

    return { client: module.get(ActivityFeedClient), received, token, stop };
  }
});
