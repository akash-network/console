import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createHash, randomBytes } from "node:crypto";
import { Err, Ok, Result } from "ts-results";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Namespaced } from "@src/lib/types/namespaced-config.type";
import { NotificationEnvConfig } from "@src/modules/notifications/config/env.config";
import * as schema from "@src/modules/notifications/model-schemas";
import { PendingAddressRepository } from "@src/modules/notifications/repositories/pending-address/pending-address.repository";
import { EmailSenderService } from "../email-sender/email-sender.service";

/** How often one address can be asked to confirm over a rolling day, whoever adds it. */
export const MAX_CONFIRMATION_EMAILS_PER_ADDRESS_PER_DAY = 3;

/** How many confirmation emails one user's changes can send over a rolling day, whatever the addresses. */
export const MAX_CONFIRMATION_EMAILS_PER_USER_PER_DAY = 20;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface AccountEmail {
  address: string;
  isVerified: boolean;
}

export interface ConfirmationRequester {
  userId: string;
  accountEmail: AccountEmail | null;
}

export interface ChannelAddresses {
  confirmed: string[];
  pending: string[];
}

interface ConfirmableChannel {
  id: string;
  userId: string;
}

export type ResendConfirmationError = "NOT_PENDING" | "RATE_LIMITED";

export interface PendingConfirmation {
  address: string;
  token: string;
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function distinctAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();

  return addresses.filter(address => {
    const normalized = normalizeAddress(address);
    const isFirst = !seen.has(normalized);
    seen.add(normalized);

    return isFirst;
  });
}

/** Addresses already confirmed on the channel stay confirmed, and so does the requester's own verified email; every other address waits for confirmation. */
export function splitAddresses(requested: string[], { confirmed, accountEmail }: { confirmed: string[]; accountEmail: AccountEmail | null }): ChannelAddresses {
  const trusted = new Set(confirmed.map(normalizeAddress));

  if (accountEmail?.isVerified) {
    trusted.add(normalizeAddress(accountEmail.address));
  }

  const distinct = distinctAddresses(requested);

  return {
    confirmed: distinct.filter(address => trusted.has(normalizeAddress(address))),
    pending: distinct.map(normalizeAddress).filter(address => !trusted.has(address))
  };
}

@Injectable()
export class AddressConfirmationService {
  constructor(
    private readonly pendingAddressRepository: PendingAddressRepository,
    private readonly emailSenderService: EmailSenderService,
    private readonly configService: ConfigService<Namespaced<"notifications", NotificationEnvConfig>>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(AddressConfirmationService.name);
  }

  async pendingAddressesOf(channelIds: string[], tx?: NodePgDatabase<typeof schema>): Promise<Map<string, string[]>> {
    const pendingAddresses = new Map<string, string[]>(channelIds.map(id => [id, []]));

    for (const { notificationChannelId, address } of await this.pendingAddressRepository.findByChannelIds(channelIds, tx)) {
      pendingAddresses.get(notificationChannelId)?.push(address);
    }

    return pendingAddresses;
  }

  async requestConfirmations(channel: ConfirmableChannel, addresses: string[], requester: ConfirmationRequester): Promise<void> {
    await this.emailConfirmations(channel, await this.holdForConfirmation(channel.id, addresses), requester);
  }

  /** Stores the addresses as pending with fresh tokens and returns the confirmations to email once the change that holds them commits. */
  async holdForConfirmation(channelId: string, addresses: string[], tx?: NodePgDatabase<typeof schema>): Promise<PendingConfirmation[]> {
    const confirmations = addresses.map(address => ({ address, token: randomBytes(32).toString("base64url") }));

    await this.pendingAddressRepository.upsert(
      confirmations.map(({ address, token }) => ({ notificationChannelId: channelId, address, tokenHash: hashToken(token) })),
      tx
    );

    return confirmations;
  }

  /** The requester's own unverified email waits without an email, since verifying the account confirms it. */
  async emailConfirmations(channel: ConfirmableChannel, confirmations: PendingConfirmation[], requester: ConfirmationRequester): Promise<void> {
    const accountAddress = requester.accountEmail && normalizeAddress(requester.accountEmail.address);

    for (const confirmation of confirmations.filter(({ address }) => address !== accountAddress)) {
      await this.#sendWithinLimits(channel, confirmation, requester.userId).catch(error => {
        this.loggerService.error({ event: "ADDRESS_CONFIRMATION_EMAIL_FAILED", notificationChannelId: channel.id, userId: requester.userId, error });
      });
    }
  }

  async forget(channelId: string, addresses: string[], tx?: NodePgDatabase<typeof schema>): Promise<void> {
    await this.pendingAddressRepository.deleteFromChannel(channelId, addresses, tx);
  }

  async resend(channel: ConfirmableChannel, address: string, requester: ConfirmationRequester): Promise<Result<void, ResendConfirmationError>> {
    const confirmation = { address: normalizeAddress(address), token: randomBytes(32).toString("base64url") };

    if (!(await this.#isWithinLimits(requester.userId, confirmation.address))) {
      return Err("RATE_LIMITED");
    }

    const isPending = await this.pendingAddressRepository.replaceToken({
      notificationChannelId: channel.id,
      address: confirmation.address,
      tokenHash: hashToken(confirmation.token)
    });

    if (!isPending) {
      return Err("NOT_PENDING");
    }

    await this.#send(channel, confirmation, requester.userId);

    return Ok(undefined);
  }

  async confirm(token: string): Promise<boolean> {
    return await this.pendingAddressRepository.confirmByTokenHash(hashToken(token));
  }

  async confirmVerifiedEmail(userId: string, accountEmail: AccountEmail | null): Promise<void> {
    if (!accountEmail?.isVerified) return;

    await this.pendingAddressRepository.confirmOnChannelsOf(userId, normalizeAddress(accountEmail.address));
  }

  async #sendWithinLimits(channel: ConfirmableChannel, confirmation: { address: string; token: string }, senderUserId: string): Promise<void> {
    if (!(await this.#isWithinLimits(senderUserId, confirmation.address))) {
      this.loggerService.warn({ event: "ADDRESS_CONFIRMATION_EMAIL_DEFERRED", notificationChannelId: channel.id, userId: senderUserId });
      return;
    }

    await this.#send(channel, confirmation, senderUserId);
  }

  async #isWithinLimits(userId: string, address: string): Promise<boolean> {
    const since = new Date(Date.now() - ONE_DAY_MS);
    const [sentByUser, sentToAddress] = await Promise.all([
      this.pendingAddressRepository.countConfirmationEmailsSince({ userId }, since),
      this.pendingAddressRepository.countConfirmationEmailsSince({ address }, since)
    ]);

    return sentByUser < MAX_CONFIRMATION_EMAILS_PER_USER_PER_DAY && sentToAddress < MAX_CONFIRMATION_EMAILS_PER_ADDRESS_PER_DAY;
  }

  async #send(channel: ConfirmableChannel, { address, token }: { address: string; token: string }, senderUserId: string): Promise<void> {
    const webUrl = this.configService.get("notifications.CONSOLE_WEB_URL");

    if (!webUrl) {
      throw new Error("CONSOLE_WEB_URL must be set to send address confirmation emails");
    }

    await this.pendingAddressRepository.recordConfirmationEmail(senderUserId, address);
    await this.emailSenderService.send({
      userId: channel.userId,
      addresses: [address],
      subject: "Confirm your email address for Akash Console alerts",
      content:
        "<p>This address was added to a notification channel on Akash Console. Confirm it to start receiving the channel's alerts here.</p>" +
        "<p>If you don't want these alerts, ignore this email. No alerts are sent to this address until it is confirmed.</p>",
      actions: [{ label: "Confirm email address", url: `${webUrl}/alerts/confirm-address?token=${token}` }],
      receivingReason: "this address was added to a notification channel on Akash Console"
    });
    this.loggerService.info({ event: "ADDRESS_CONFIRMATION_EMAIL_SENT", notificationChannelId: channel.id, userId: senderUserId });
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
