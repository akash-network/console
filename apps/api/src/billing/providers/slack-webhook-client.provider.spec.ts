import nock from "nock";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished } from "vitest";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "./slack-webhook-client.provider";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/secret-path";

describe("SLACK_WEBHOOK_HTTP_CLIENT", () => {
  it("rejects a post Slack answers with an error with Slack's status and error only", async () => {
    const { post } = setup();
    nock(SLACK_ORIGIN).post(SLACK_PATH).reply(404, "no_service");

    const error = await post(`${SLACK_ORIGIN}${SLACK_PATH}`).catch((rejection: unknown) => rejection);

    expect(error).toEqual(new Error("Slack webhook answered 404: no_service"));
    expect(error).not.toHaveProperty("cause");
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(SLACK_PATH);
  });

  it("rejects a post that never reached Slack with the transport error code only", async () => {
    const { post } = setup();

    const error = await post(`${await closedPortOrigin()}${SLACK_PATH}`).catch((rejection: unknown) => rejection);

    expect(error).toEqual(new Error("Slack webhook failed: ECONNREFUSED"));
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(SLACK_PATH);
  });

  it("resolves a post Slack accepts", async () => {
    const { post } = setup();
    nock(SLACK_ORIGIN).post(SLACK_PATH).reply(200, "ok");

    const response = await post(`${SLACK_ORIGIN}${SLACK_PATH}`);

    expect(response.data).toBe("ok");
  });

  async function closedPortOrigin() {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise(resolve => server.close(resolve));

    return `http://127.0.0.1:${port}`;
  }

  function setup() {
    onTestFinished(() => {
      nock.cleanAll();
    });

    const client = container.createChildContainer().resolve(SLACK_WEBHOOK_HTTP_CLIENT);

    return { post: (url: string) => client.post(url, { text: "alert" }) };
  }
});
