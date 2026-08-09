import type { InboxClient, InboxMessage } from "./inbox-client";

interface WorkerInboxMessage {
  id: string;
  receivedMs: number;
  subject: string;
  text: string;
}

/** Cap each inbox read so a stalled worker connection aborts and lets InboxCodeStrategy retry within its poll deadline. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Inbox backed by the self-hosted Cloudflare Email Worker (tools/e2e-inbox-worker): a catch-all
 * rule on the e2e email domain stores incoming mail in D1, and this client reads it back through
 * the worker's token-protected HTTP endpoint. The endpoint returns message bodies inline, so
 * `fetchMessageBody` serves from the payload cached by the last `fetchMessages` call.
 */
export class WorkerInboxClient implements InboxClient {
  readonly #apiUrl: string;
  readonly #apiToken: string;
  readonly #emailDomain: string;
  readonly #bodiesByMessageId = new Map<string, string>();

  constructor(config: { apiUrl: string; apiToken: string; emailDomain: string }) {
    this.#apiUrl = config.apiUrl;
    this.#apiToken = config.apiToken;
    this.#emailDomain = config.emailDomain;
  }

  generateEmail(): string {
    return `e2e-${crypto.randomUUID().slice(0, 8)}@${this.#emailDomain}`;
  }

  async fetchMessages(email: string): Promise<InboxMessage[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.#apiUrl}/messages/${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${this.#apiToken}` },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Inbox worker request failed (${response.status}): ${await response.text()}`);
      }

      const messages: WorkerInboxMessage[] = await response.json();
      for (const message of messages) {
        this.#bodiesByMessageId.set(message.id, message.text);
      }
      return messages.map(({ id, receivedMs, subject }) => ({ id, receivedMs, subject }));
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchMessageBody(email: string, messageId: string): Promise<string> {
    const body = this.#bodiesByMessageId.get(messageId);
    if (body === undefined) {
      throw new Error(`Inbox worker returned no body for message ${messageId} of ${email}; call fetchMessages first`);
    }
    return body;
  }
}
