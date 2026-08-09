import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkerInboxClient } from "./worker-inbox.client";

describe(WorkerInboxClient.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("generateEmail", () => {
    it("generates a unique address on the configured domain", () => {
      const { client } = setup();

      expect(client.generateEmail()).toMatch(/^e2e-[0-9a-f]{8}@e2e\.example\.test$/);
    });
  });

  describe("fetchMessages", () => {
    it("requests the encoded recipient with the bearer token and maps message metadata", async () => {
      const { client, fetchMock } = setup({ messages: [{ id: "m1", receivedMs: 123, subject: "Hi", text: "code 111111" }] });

      const messages = await client.fetchMessages("probe@e2e.example.test");

      expect(fetchMock).toHaveBeenCalledWith("https://inbox.test/messages/probe%40e2e.example.test", {
        headers: { Authorization: "Bearer secret" }
      });
      expect(messages).toEqual([{ id: "m1", receivedMs: 123, subject: "Hi" }]);
    });

    it("throws with status and body when the worker responds with an error", async () => {
      const { client } = setup({ response: new Response("nope", { status: 401 }) });

      await expect(client.fetchMessages("probe@e2e.example.test")).rejects.toThrow("Inbox worker request failed (401): nope");
    });
  });

  describe("fetchMessageBody", () => {
    it("serves the body cached by the last fetchMessages call without another request", async () => {
      const { client, fetchMock } = setup({ messages: [{ id: "m1", receivedMs: 1, subject: "Hi", text: "the body" }] });
      await client.fetchMessages("probe@e2e.example.test");

      await expect(client.fetchMessageBody("probe@e2e.example.test", "m1")).resolves.toBe("the body");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws for a message id that was never listed", async () => {
      const { client } = setup();

      await expect(client.fetchMessageBody("probe@e2e.example.test", "missing")).rejects.toThrow(/no body for message missing/);
    });
  });

  function setup(input?: { messages?: Array<{ id: string; receivedMs: number; subject: string; text: string }>; response?: Response }) {
    const fetchMock = vi.fn().mockResolvedValue(input?.response ?? Response.json(input?.messages ?? []));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WorkerInboxClient({
      apiUrl: "https://inbox.test",
      apiToken: "secret",
      emailDomain: "e2e.example.test"
    });

    return { client, fetchMock };
  }
});
