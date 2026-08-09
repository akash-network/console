import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import schema from "../schema.sql?raw";
import worker from "./index";

const HOUR_MS = 60 * 60 * 1_000;

describe("console-e2e-inbox worker", () => {
  describe("email handler", () => {
    it("stores a plain-text email retrievable through the messages endpoint", async () => {
      const { deliverEmail, getMessages } = await setup();

      await deliverEmail({
        to: "probe@e2e.akash.network",
        mime: plainTextEmail("probe@e2e.akash.network", "Your verification code", "Your verification code is: 123456")
      });

      const response = await getMessages("probe@e2e.akash.network");
      const messages = await response.json<Array<{ subject: string; text: string; receivedMs: number }>>();
      expect(response.status).toBe(200);
      expect(messages).toHaveLength(1);
      expect(messages[0].subject).toBe("Your verification code");
      expect(messages[0].text).toContain("Your verification code is: 123456");
      expect(messages[0].receivedMs).toBeGreaterThan(Date.now() - HOUR_MS);
    });

    it("converts html-only emails to plain text with style blocks stripped", async () => {
      const { deliverEmail, getMessages } = await setup();

      await deliverEmail({
        to: "htmlonly@e2e.akash.network",
        mime: htmlEmail("htmlonly@e2e.akash.network", "<style>p{color:red}</style><p>Your verification code is:</p><h1>654321</h1>")
      });

      const messages = await (await getMessages("htmlonly@e2e.akash.network")).json<Array<{ text: string }>>();
      expect(messages[0].text).toBe("Your verification code is: 654321");
    });

    it("lowercases the recipient so lookups are case-insensitive", async () => {
      const { deliverEmail, getMessages } = await setup();

      await deliverEmail({
        to: "Mixed.Case@E2E.akash.network",
        mime: plainTextEmail("Mixed.Case@E2E.akash.network", "Hi", "code 111111")
      });

      const messages = await (await getMessages("mixed.case@e2e.akash.network")).json<Array<{ text: string }>>();
      expect(messages).toHaveLength(1);
    });

    it("purges messages older than 24h when a new email arrives", async () => {
      const { deliverEmail, getMessages, insertMessageRow } = await setup();
      await insertMessageRow({ recipient: "old@e2e.akash.network", receivedMs: Date.now() - 25 * HOUR_MS });
      await insertMessageRow({ recipient: "recent@e2e.akash.network", receivedMs: Date.now() - HOUR_MS });

      await deliverEmail({
        to: "fresh@e2e.akash.network",
        mime: plainTextEmail("fresh@e2e.akash.network", "Hi", "code 222222")
      });

      expect(await (await getMessages("old@e2e.akash.network")).json()).toEqual([]);
      expect(await (await getMessages("recent@e2e.akash.network")).json<unknown[]>()).toHaveLength(1);
      expect(await (await getMessages("fresh@e2e.akash.network")).json<unknown[]>()).toHaveLength(1);
    });
  });

  describe("fetch handler", () => {
    it("returns messages newest-first", async () => {
      const { getMessages, insertMessageRow } = await setup();
      await insertMessageRow({ recipient: "ordered@e2e.akash.network", subject: "older", receivedMs: 1_000 });
      await insertMessageRow({ recipient: "ordered@e2e.akash.network", subject: "newer", receivedMs: 2_000 });

      const messages = await (await getMessages("ordered@e2e.akash.network")).json<Array<{ subject: string; receivedMs: number }>>();

      expect(messages.map(message => message.subject)).toEqual(["newer", "older"]);
    });

    it("returns an empty list for an inbox that never received mail", async () => {
      const { getMessages } = await setup();

      const response = await getMessages("empty@e2e.akash.network");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });

    it("rejects requests without a token", async () => {
      const { request } = await setup();

      const response = await request("/messages/probe@e2e.akash.network", {});

      expect(response.status).toBe(401);
    });

    it("rejects requests with a wrong token", async () => {
      const { request } = await setup();

      const response = await request("/messages/probe@e2e.akash.network", { headers: { Authorization: "Bearer wrong" } });

      expect(response.status).toBe(401);
    });

    it("returns 404 for unknown paths", async () => {
      const { request } = await setup();

      const response = await request("/other", { headers: { Authorization: "Bearer test-token" } });

      expect(response.status).toBe(404);
    });

    it("returns 404 for non-GET methods on the messages path", async () => {
      const { request } = await setup();

      const response = await request("/messages/probe@e2e.akash.network", { method: "POST", headers: { Authorization: "Bearer test-token" } });

      expect(response.status).toBe(404);
    });
  });

  async function setup() {
    const statements = schema
      .split(";")
      .map(statement => statement.trim())
      .filter(Boolean);
    await env.DB.batch(statements.map(statement => env.DB.prepare(statement)));

    async function deliverEmail(input: { to: string; mime: string }): Promise<void> {
      const message = Object.assign(mock<ForwardableEmailMessage>({ to: input.to, rawSize: input.mime.length }), {
        raw: new Response(input.mime).body as ReadableStream<Uint8Array>
      });
      await worker.email(message, env);
    }

    function request(path: string, init: RequestInit<IncomingRequestCfProperties>): Promise<Response> {
      return worker.fetch(new Request<unknown, IncomingRequestCfProperties>(`https://inbox.test${path}`, init), env);
    }

    function getMessages(email: string): Promise<Response> {
      return request(`/messages/${encodeURIComponent(email)}`, { headers: { Authorization: "Bearer test-token" } });
    }

    async function insertMessageRow(input: { recipient: string; receivedMs: number; subject?: string }): Promise<void> {
      await env.DB.prepare("INSERT INTO messages (id, recipient, received_ms, subject, text_body) VALUES (?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), input.recipient, input.receivedMs, input.subject ?? "", "body")
        .run();
    }

    return { deliverEmail, request, getMessages, insertMessageRow };
  }
});

function plainTextEmail(to: string, subject: string, body: string): string {
  return [
    "From: no-reply@auth0.com",
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: <${crypto.randomUUID()}@example.com>`,
    "Content-Type: text/plain",
    "",
    body
  ].join("\r\n");
}

function htmlEmail(to: string, htmlBody: string): string {
  return [
    "From: no-reply@auth0.com",
    `To: ${to}`,
    "Subject: Welcome",
    `Message-ID: <${crypto.randomUUID()}@example.com>`,
    "Content-Type: text/html",
    "",
    `<html><body>${htmlBody}</body></html>`
  ].join("\r\n");
}
