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
        to: "probe@example.com",
        mime: plainTextEmail("probe@example.com", "Your verification code", "Your verification code is: 123456")
      });

      const response = await getMessages("probe@example.com");
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
        to: "htmlonly@example.com",
        mime: htmlEmail("htmlonly@example.com", "<style>p{color:red}</style><p>Your verification code is:</p><h1>654321</h1>")
      });

      const messages = await (await getMessages("htmlonly@example.com")).json<Array<{ text: string }>>();
      expect(messages[0].text).toBe("Your verification code is: 654321");
    });

    it("falls back to the html body when the text part is present but empty", async () => {
      const { deliverEmail, getMessages } = await setup();

      await deliverEmail({
        to: "emptytext@example.com",
        mime: multipartAlternativeEmail("emptytext@example.com", "", "<p>Your verification code is:</p><h1>654321</h1>")
      });

      const messages = await (await getMessages("emptytext@example.com")).json<Array<{ text: string }>>();
      expect(messages[0].text).toBe("Your verification code is: 654321");
    });

    it("lowercases the recipient so lookups are case-insensitive", async () => {
      const { deliverEmail, getMessages } = await setup();

      await deliverEmail({
        to: "Mixed.Case@Example.com",
        mime: plainTextEmail("Mixed.Case@Example.com", "Hi", "code 111111")
      });

      const messages = await (await getMessages("mixed.case@example.com")).json<Array<{ text: string }>>();
      expect(messages).toHaveLength(1);
    });

    it("purges messages older than 24h when a new email arrives", async () => {
      const { deliverEmail, getMessages, insertMessageRow } = await setup();
      await insertMessageRow({ recipient: "old@example.com", receivedMs: Date.now() - 25 * HOUR_MS });
      await insertMessageRow({ recipient: "recent@example.com", receivedMs: Date.now() - HOUR_MS });

      await deliverEmail({
        to: "fresh@example.com",
        mime: plainTextEmail("fresh@example.com", "Hi", "code 222222")
      });

      expect(await (await getMessages("old@example.com")).json()).toEqual([]);
      expect(await (await getMessages("recent@example.com")).json<unknown[]>()).toHaveLength(1);
      expect(await (await getMessages("fresh@example.com")).json<unknown[]>()).toHaveLength(1);
    });
  });

  describe("fetch handler", () => {
    it("returns messages newest-first", async () => {
      const { getMessages, insertMessageRow } = await setup();
      await insertMessageRow({ recipient: "ordered@example.com", subject: "older", receivedMs: Date.now() - 2 * HOUR_MS });
      await insertMessageRow({ recipient: "ordered@example.com", subject: "newer", receivedMs: Date.now() - HOUR_MS });

      const messages = await (await getMessages("ordered@example.com")).json<Array<{ subject: string; receivedMs: number }>>();

      expect(messages.map(message => message.subject)).toEqual(["newer", "older"]);
    });

    it("excludes messages older than 24h from reads even without a new email", async () => {
      const { getMessages, insertMessageRow } = await setup();
      await insertMessageRow({ recipient: "readcutoff-stale@example.com", receivedMs: Date.now() - 25 * HOUR_MS });

      expect(await (await getMessages("readcutoff-stale@example.com")).json()).toEqual([]);
    });

    it("returns an empty list for an inbox that never received mail", async () => {
      const { getMessages } = await setup();

      const response = await getMessages("empty@example.com");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });

    it("rejects requests without a token", async () => {
      const { request } = await setup();

      const response = await request("/messages/probe@example.com", {});

      expect(response.status).toBe(401);
    });

    it("rejects requests with a wrong token", async () => {
      const { request } = await setup();

      const response = await request("/messages/probe@example.com", { headers: { Authorization: "Bearer wrong" } });

      expect(response.status).toBe(401);
    });

    it("returns 404 for unknown paths", async () => {
      const { request } = await setup();

      const response = await request("/other", { headers: { Authorization: "Bearer test-token" } });

      expect(response.status).toBe(404);
    });

    it("returns 404 for non-GET methods on the messages path", async () => {
      const { request } = await setup();

      const response = await request("/messages/probe@example.com", { method: "POST", headers: { Authorization: "Bearer test-token" } });

      expect(response.status).toBe(404);
    });
  });

  describe("scheduled handler", () => {
    it("deletes messages older than 24h and keeps fresh ones", async () => {
      const { runScheduled, insertMessageRow, countRows } = await setup();
      await insertMessageRow({ recipient: "cron-stale@example.com", receivedMs: Date.now() - 25 * HOUR_MS });
      await insertMessageRow({ recipient: "cron-fresh@example.com", receivedMs: Date.now() - HOUR_MS });

      await runScheduled();

      expect(await countRows("cron-stale@example.com")).toBe(0);
      expect(await countRows("cron-fresh@example.com")).toBe(1);
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

    async function countRows(recipient: string): Promise<number> {
      const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM messages WHERE recipient = ?").bind(recipient).first<{ count: number }>();
      return row?.count ?? 0;
    }

    async function runScheduled(): Promise<void> {
      await worker.scheduled(mock<ScheduledController>(), env);
    }

    return { deliverEmail, request, getMessages, insertMessageRow, countRows, runScheduled };
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

function multipartAlternativeEmail(to: string, textBody: string, htmlBody: string): string {
  return [
    "From: no-reply@auth0.com",
    `To: ${to}`,
    "Subject: Welcome",
    `Message-ID: <${crypto.randomUUID()}@example.com>`,
    'Content-Type: multipart/alternative; boundary="boundary42"',
    "",
    "--boundary42",
    "Content-Type: text/plain; charset=utf-8",
    "",
    textBody,
    "--boundary42",
    "Content-Type: text/html; charset=utf-8",
    "",
    `<html><body>${htmlBody}</body></html>`,
    "--boundary42--"
  ].join("\r\n");
}
