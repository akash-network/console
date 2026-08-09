import PostalMime from "postal-mime";

interface Env {
  DB: D1Database;
  INBOX_API_TOKEN: string;
}

/** Messages older than this are purged opportunistically on each insert, so no cron trigger is needed. */
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1_000;

const MESSAGES_PATH = /^\/messages\/([^/]+)$/;

export default {
  async email(message, env): Promise<void> {
    const parsed = await PostalMime.parse(message.raw);
    const textBody = parsed.text ?? htmlToText(parsed.html ?? "");

    await env.DB.batch([
      env.DB.prepare("DELETE FROM messages WHERE received_ms < ?").bind(Date.now() - MESSAGE_TTL_MS),
      env.DB.prepare("INSERT INTO messages (id, recipient, received_ms, subject, text_body) VALUES (?, ?, ?, ?, ?)").bind(
        crypto.randomUUID(),
        message.to.toLowerCase(),
        Date.now(),
        parsed.subject ?? "",
        textBody
      )
    ]);
  },

  async fetch(request, env): Promise<Response> {
    if (!isAuthorized(request, env)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const recipientMatch = request.method === "GET" ? new URL(request.url).pathname.match(MESSAGES_PATH) : null;
    if (!recipientMatch) {
      return new Response("Not found", { status: 404 });
    }

    const recipient = decodeURIComponent(recipientMatch[1]).toLowerCase();
    const { results } = await env.DB.prepare("SELECT id, received_ms, subject, text_body FROM messages WHERE recipient = ? ORDER BY received_ms DESC")
      .bind(recipient)
      .all();

    return Response.json(
      results.map(row => ({
        id: row.id,
        receivedMs: row.received_ms,
        subject: row.subject,
        text: row.text_body
      }))
    );
  }
} satisfies ExportedHandler<Env>;

function isAuthorized(request: Request, env: Env): boolean {
  return Boolean(env.INBOX_API_TOKEN) && request.headers.get("Authorization") === `Bearer ${env.INBOX_API_TOKEN}`;
}

/** Fallback for emails that carry only an HTML part: strip tags so OTP-code regexes can run over plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
