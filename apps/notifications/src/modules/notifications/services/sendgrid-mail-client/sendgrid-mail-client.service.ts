import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExponentialBackoff, handleWhen, retry } from "cockatiel";

import type { NotificationsConfig } from "@src/modules/notifications/config";

export type SendgridMail = {
  to: string[];
  subject: string;
  html: string;
  categories?: string[];
  headers?: Record<string, string>;
};

export class SendgridRequestError extends Error {
  constructor(
    readonly status: number,
    body: string
  ) {
    super(`SendGrid answered ${status}: ${body}`);
  }
}

@Injectable()
export class SendgridMailClient {
  readonly #retryPolicy = retry(handleWhen(isRetriable), {
    maxAttempts: 2,
    backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 2_000 })
  });

  constructor(private readonly configService: ConfigService<NotificationsConfig>) {}

  /** Sends one copy per address, so recipients of a shared channel never see each other's address. */
  async send(mail: SendgridMail): Promise<{ messageId: string | null }> {
    return await this.#retryPolicy.execute(() => this.#post(mail));
  }

  async #post({ to, subject, html, categories, headers }: SendgridMail): Promise<{ messageId: string | null }> {
    const name = this.configService.get("notifications.EMAIL_FROM_NAME");
    const response = await fetch(`${this.configService.getOrThrow("notifications.SENDGRID_API_BASE_URL")}/v3/mail/send`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.configService.getOrThrow("notifications.SENDGRID_API_KEY")}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        personalizations: to.map(email => ({ to: [{ email }] })),
        from: { email: this.configService.getOrThrow("notifications.EMAIL_FROM_ADDRESS"), ...(name && { name }) },
        subject,
        content: [{ type: "text/html", value: html }],
        ...(categories && { categories }),
        ...(headers && { headers })
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(this.configService.getOrThrow("notifications.SENDGRID_TIMEOUT_MS"))
    });

    if (!response.ok) {
      throw new SendgridRequestError(response.status, await response.text());
    }

    return { messageId: response.headers.get("x-message-id") };
  }
}

/** Timeouts are not retried since SendGrid may have accepted the email; 429s, 5xx and other connection failures are, accepting a rare double send. */
function isRetriable(error: Error): boolean {
  if (error instanceof SendgridRequestError) {
    return error.status === 429 || error.status >= 500;
  }

  return error.name !== "TimeoutError";
}
