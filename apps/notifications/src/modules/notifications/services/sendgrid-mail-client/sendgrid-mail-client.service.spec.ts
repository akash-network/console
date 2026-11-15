import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock } from "vitest-mock-extended";

import { type SendgridMail, SendgridMailClient, SendgridRequestError } from "./sendgrid-mail-client.service";

describe(SendgridMailClient.name, () => {
  it("posts the email to SendGrid's mail send endpoint with the api key", async () => {
    const { client, received, apiKey, fromAddress, fromName } = await setup({});
    const mail = createMail();

    await client.send(mail);

    expect(received).toEqual([
      {
        method: "POST",
        url: "/v3/mail/send",
        contentType: "application/json",
        authorization: `Bearer ${apiKey}`,
        body: {
          personalizations: [{ to: [{ email: mail.to[0] }] }],
          from: { email: fromAddress, name: fromName },
          subject: mail.subject,
          content: [{ type: "text/html", value: mail.html }]
        }
      }
    ]);
  });

  it("gives each address its own copy so recipients never see each other", async () => {
    const { client, received } = await setup({});
    const to = [faker.internet.email(), faker.internet.email()];

    await client.send(createMail({ to }));

    expect(received[0].body).toMatchObject({ personalizations: [{ to: [{ email: to[0] }] }, { to: [{ email: to[1] }] }] });
  });

  it("passes the email's headers through to SendGrid", async () => {
    const { client, received } = await setup({});
    const headers = { "List-Unsubscribe": "<https://console-api.akash.network/unsubscribe>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };

    await client.send(createMail({ headers }));

    expect(received[0].body).toMatchObject({ headers });
  });

  it("sends from the bare address when no sender name is set", async () => {
    const { client, received, fromAddress } = await setup({ fromName: undefined });

    await client.send(createMail());

    expect(received[0].body).toMatchObject({ from: { email: fromAddress } });
    expect(received[0].body).not.toHaveProperty("from.name");
  });

  it("returns the message id SendGrid assigned", async () => {
    const { client } = await setup({
      respond: response => {
        response.writeHead(202, { "x-message-id": "sg-message-id" });
        response.end();
      }
    });

    await expect(client.send(createMail())).resolves.toEqual({ messageId: "sg-message-id" });
  });

  it("returns no message id when SendGrid does not send one", async () => {
    const { client } = await setup({});

    await expect(client.send(createMail())).resolves.toEqual({ messageId: null });
  });

  it("fails with what SendGrid answered without retrying when it refuses the email", async () => {
    const { client, received } = await setup({
      respond: response => {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ errors: [{ message: "Does not contain a valid address." }] }));
      }
    });

    const error = await client.send(createMail()).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SendgridRequestError);
    expect(error).toMatchObject({ status: 400, message: 'SendGrid answered 400: {"errors":[{"message":"Does not contain a valid address."}]}' });
    expect(received).toHaveLength(1);
  });

  it.each([429, 500, 503])("retries an email SendGrid answered %i to until it takes it", async status => {
    const { client, received } = await setup({ respond: respondWith([status, status, 202]) });

    await expect(client.send(createMail())).resolves.toEqual({ messageId: null });
    expect(received).toHaveLength(3);
  });

  it("gives up after two retries while SendGrid stays unavailable", async () => {
    const { client, received } = await setup({ respond: respondWith([503, 503, 503, 202]) });

    await expect(client.send(createMail())).rejects.toMatchObject({ status: 503 });
    expect(received).toHaveLength(3);
  });

  it("fails on a redirect instead of following it", async () => {
    const { client, received } = await setup({
      respond: (response, request) => {
        response.writeHead(307, { location: `${request.url}/elsewhere` });
        response.end();
      }
    });

    await expect(client.send(createMail())).rejects.toMatchObject({ status: 307 });
    expect(received).toHaveLength(1);
  });

  it("gives up without retrying once SendGrid takes longer than the timeout to answer, since it may have taken the email", async () => {
    const { client, received } = await setup({ timeoutMs: 50, respond: () => {} });

    await expect(client.send(createMail())).rejects.toMatchObject({ name: "TimeoutError" });
    expect(received).toHaveLength(1);
  });

  it("retries an email whose connection dropped before SendGrid answered", async () => {
    let call = 0;
    const { client, received } = await setup({
      respond: (response, request) => {
        if (call++ === 0) return request.socket.destroy();
        response.writeHead(202);
        response.end();
      }
    });

    await expect(client.send(createMail())).resolves.toEqual({ messageId: null });
    expect(received).toHaveLength(2);
  });

  it("retries and then fails when SendGrid cannot be reached", async () => {
    const { client, stop } = await setup({});
    await stop();

    await expect(client.send(createMail())).rejects.toThrow("fetch failed");
  });

  function createMail(overrides: Partial<SendgridMail> = {}): SendgridMail {
    return {
      to: [faker.internet.email()],
      subject: faker.lorem.sentence(),
      html: `<!DOCTYPE html><p>${faker.lorem.paragraph()}</p>`,
      ...overrides
    };
  }

  function respondWith(statuses: number[]) {
    let call = 0;

    return (response: ServerResponse) => {
      response.writeHead(statuses[call++]);
      response.end();
    };
  }

  async function setup(input: { fromName?: string; timeoutMs?: number; respond?: (response: ServerResponse, request: IncomingMessage) => void }) {
    const received: Array<{ method?: string; url?: string; contentType?: string; authorization?: string; body: unknown }> = [];
    const respond =
      input.respond ??
      ((response: ServerResponse) => {
        response.writeHead(202);
        response.end();
      });
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      received.push({
        method: request.method,
        url: request.url,
        contentType: request.headers["content-type"],
        authorization: request.headers.authorization,
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

    const apiKey = `SG.${faker.string.alphanumeric(32)}`;
    const fromAddress = faker.internet.email();
    const fromName = "fromName" in input ? input.fromName : "Akash Console";
    const config: Record<string, unknown> = {
      "notifications.SENDGRID_API_BASE_URL": `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      "notifications.SENDGRID_API_KEY": apiKey,
      "notifications.SENDGRID_TIMEOUT_MS": input.timeoutMs ?? 2000,
      "notifications.EMAIL_FROM_ADDRESS": fromAddress,
      "notifications.EMAIL_FROM_NAME": fromName
    };
    const configService = mock<ConfigService>();
    configService.get.mockImplementation((key: string) => config[key]);
    configService.getOrThrow.mockImplementation((key: string) => config[key]);
    const module = await Test.createTestingModule({ providers: [SendgridMailClient, { provide: ConfigService, useValue: configService }] }).compile();

    return { client: module.get(SendgridMailClient), received, apiKey, fromAddress, fromName, stop };
  }
});
