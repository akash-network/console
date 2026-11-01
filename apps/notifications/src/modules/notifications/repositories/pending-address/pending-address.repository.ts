import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import * as schema from "../../model-schemas";
import { notificationChannelConfigSchema } from "../notification-channel/notification-channel.repository";

export interface PendingAddressInput {
  notificationChannelId: string;
  address: string;
  tokenHash: string;
}

export interface PendingAddressOutput {
  notificationChannelId: string;
  address: string;
}

@Injectable()
export class PendingAddressRepository {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>
  ) {}

  async findByChannelIds(notificationChannelIds: string[], tx: NodePgDatabase<typeof schema> = this.db): Promise<PendingAddressOutput[]> {
    if (!notificationChannelIds.length) return [];

    return await tx
      .select({
        notificationChannelId: schema.NotificationChannelPendingAddress.notificationChannelId,
        address: schema.NotificationChannelPendingAddress.address
      })
      .from(schema.NotificationChannelPendingAddress)
      .where(inArray(schema.NotificationChannelPendingAddress.notificationChannelId, notificationChannelIds))
      .orderBy(schema.NotificationChannelPendingAddress.createdAt, schema.NotificationChannelPendingAddress.address);
  }

  async upsert(pendingAddresses: PendingAddressInput[], tx: NodePgDatabase<typeof schema> = this.db): Promise<void> {
    if (!pendingAddresses.length) return;

    await tx
      .insert(schema.NotificationChannelPendingAddress)
      .values(pendingAddresses)
      .onConflictDoUpdate({
        target: [schema.NotificationChannelPendingAddress.notificationChannelId, schema.NotificationChannelPendingAddress.address],
        set: { tokenHash: sql`excluded.token_hash`, updatedAt: sql`now()` }
      });
  }

  async replaceToken({ notificationChannelId, address, tokenHash }: PendingAddressInput): Promise<boolean> {
    const updated = await this.db
      .update(schema.NotificationChannelPendingAddress)
      .set({ tokenHash, updatedAt: sql`now()` })
      .where(this.#pendingOn(notificationChannelId, [address]))
      .returning({ id: schema.NotificationChannelPendingAddress.id });

    return updated.length > 0;
  }

  async deleteFromChannel(notificationChannelId: string, addresses: string[], tx: NodePgDatabase<typeof schema> = this.db): Promise<void> {
    if (!addresses.length) return;

    await tx.delete(schema.NotificationChannelPendingAddress).where(this.#pendingOn(notificationChannelId, addresses));
  }

  /** The address joins its channel's addresses in the same transaction that forgets the token, so a link confirms once. */
  async confirmByTokenHash(tokenHash: string): Promise<boolean> {
    return await this.db.transaction(async tx => {
      const [pending] = await tx
        .select({ notificationChannelId: schema.NotificationChannelPendingAddress.notificationChannelId })
        .from(schema.NotificationChannelPendingAddress)
        .where(eq(schema.NotificationChannelPendingAddress.tokenHash, tokenHash));

      if (!pending || !(await this.#lockLiveChannels(tx, [pending.notificationChannelId])).length) return false;

      const [confirmed] = await tx
        .delete(schema.NotificationChannelPendingAddress)
        .where(eq(schema.NotificationChannelPendingAddress.tokenHash, tokenHash))
        .returning({
          notificationChannelId: schema.NotificationChannelPendingAddress.notificationChannelId,
          address: schema.NotificationChannelPendingAddress.address
        });

      return !!confirmed && (await this.#addToChannel(tx, confirmed));
    });
  }

  /** Confirms the address wherever it waits on a live channel the user created, for a user who has just verified it as their own. */
  async confirmOnChannelsOf(userId: string, address: string): Promise<number> {
    return await this.db.transaction(async tx => {
      const waitingOn = await tx
        .select({ notificationChannelId: schema.NotificationChannelPendingAddress.notificationChannelId })
        .from(schema.NotificationChannelPendingAddress)
        .innerJoin(schema.NotificationChannel, eq(schema.NotificationChannel.id, schema.NotificationChannelPendingAddress.notificationChannelId))
        .where(and(eq(schema.NotificationChannelPendingAddress.address, address), eq(schema.NotificationChannel.userId, userId)));
      const lockedChannelIds = await this.#lockLiveChannels(
        tx,
        waitingOn.map(({ notificationChannelId }) => notificationChannelId)
      );

      if (!lockedChannelIds.length) return 0;

      const confirmed = await tx
        .delete(schema.NotificationChannelPendingAddress)
        .where(
          and(
            eq(schema.NotificationChannelPendingAddress.address, address),
            inArray(schema.NotificationChannelPendingAddress.notificationChannelId, lockedChannelIds)
          )
        )
        .returning({ notificationChannelId: schema.NotificationChannelPendingAddress.notificationChannelId });

      for (const { notificationChannelId } of confirmed) {
        await this.#addToChannel(tx, { notificationChannelId, address });
      }

      return confirmed.length;
    });
  }

  async countConfirmationEmailsSince(sentTo: { userId: string } | { address: string }, since: Date): Promise<number> {
    const sentBy = "userId" in sentTo ? eq(schema.AddressConfirmationEmail.userId, sentTo.userId) : eq(schema.AddressConfirmationEmail.address, sentTo.address);
    const [result] = await this.db
      .select({ count: count() })
      .from(schema.AddressConfirmationEmail)
      .where(and(sentBy, gt(schema.AddressConfirmationEmail.createdAt, since)));

    return Number(result.count);
  }

  async recordConfirmationEmail(userId: string, address: string): Promise<void> {
    await this.db.insert(schema.AddressConfirmationEmail).values({ userId, address });
  }

  #pendingOn(notificationChannelId: string, addresses: string[]) {
    return and(
      eq(schema.NotificationChannelPendingAddress.notificationChannelId, notificationChannelId),
      inArray(schema.NotificationChannelPendingAddress.address, addresses)
    );
  }

  /** Locks in id order, the order every writer of channel addresses follows, so two of them never wait on each other. */
  async #lockLiveChannels(tx: NodePgDatabase<typeof schema>, channelIds: string[]): Promise<string[]> {
    if (!channelIds.length) return [];

    const channels = await tx
      .select({ id: schema.NotificationChannel.id })
      .from(schema.NotificationChannel)
      .where(and(inArray(schema.NotificationChannel.id, channelIds), isNull(schema.NotificationChannel.deletedAt)))
      .orderBy(schema.NotificationChannel.id)
      .for("update");

    return channels.map(({ id }) => id);
  }

  async #addToChannel(tx: NodePgDatabase<typeof schema>, { notificationChannelId, address }: PendingAddressOutput): Promise<boolean> {
    const [channel] = await tx
      .select({ config: schema.NotificationChannel.config })
      .from(schema.NotificationChannel)
      .where(and(eq(schema.NotificationChannel.id, notificationChannelId), isNull(schema.NotificationChannel.deletedAt)))
      .for("update");

    if (!channel) return false;

    const { addresses } = notificationChannelConfigSchema.parse(channel.config);

    if (!addresses.some(existing => existing.toLowerCase() === address)) {
      await tx
        .update(schema.NotificationChannel)
        .set({ config: { addresses: [...addresses, address] } })
        .where(eq(schema.NotificationChannel.id, notificationChannelId));
    }

    return true;
  }
}
