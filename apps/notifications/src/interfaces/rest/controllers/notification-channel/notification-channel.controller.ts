import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { ApiNoContentResponse, ApiQuery } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import { NotFoundErrorResponse, TooManyRequestsErrorResponse, ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { toPaginatedQuery, toPaginatedResponse } from "@src/lib/http-schema/http-schema";
import { isIanaTimeZone } from "@src/lib/time-zone/time-zone";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import {
  notificationChannelConfigSchema,
  NotificationChannelOutput as RepoNotificationChannelOutput,
  NotificationChannelRepository
} from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import {
  AddressConfirmationService,
  type ConfirmationRequester,
  distinctAddresses,
  normalizeAddress,
  splitAddresses
} from "@src/modules/notifications/services/address-confirmation/address-confirmation.service";

/** Channels saved before the cap may hold more addresses, and keep them until they are removed. */
export const MAX_NOTIFICATION_CHANNEL_ADDRESSES = 10;

const TOO_MANY_ADDRESSES_MESSAGE = `A notification channel can have at most ${MAX_NOTIFICATION_CHANNEL_ADDRESSES} email addresses`;

export const notificationChannelCreateInputSchema = z.object({
  name: z.string(),
  type: z.literal("email"),
  config: notificationChannelConfigSchema.extend({
    addresses: notificationChannelConfigSchema.shape.addresses
      .max(MAX_NOTIFICATION_CHANNEL_ADDRESSES, TOO_MANY_ADDRESSES_MESSAGE)
      .describe("Addresses other than the requester's verified email wait for confirmation before they receive alerts")
  }),
  isDefault: z.boolean().optional()
});

export const notificationChannelCreateDefaultInputSchema = notificationChannelCreateInputSchema.omit({ isDefault: true }).extend({
  timezone: z
    .string()
    .describe("IANA timezone the dates in the channel's emails are shown in, also set on an existing default channel. A value that names no zone is ignored.")
    .transform(timeZone => (isIanaTimeZone(timeZone) ? timeZone : undefined))
    .optional()
});

export const notificationChannelOutputSchema = notificationChannelCreateInputSchema.extend({
  config: notificationChannelConfigSchema.describe("The confirmed addresses, which receive the channel's alerts"),
  pendingAddresses: z.array(z.string()).describe("Addresses on the channel that receive no alerts until they are confirmed through the link emailed to them"),
  id: z.string().uuid(),
  userId: z.string().uuid(),
  isDefault: z.boolean(),
  timezone: z.string().nullable().describe("IANA timezone the dates in the channel's emails are shown in, UTC when there is none"),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const notificationChannelOutputResponseSchema = z.object({
  data: notificationChannelOutputSchema
});
export type NotificationChannelOutputResponse = z.infer<typeof notificationChannelOutputResponseSchema>;

export const notificationChannelPatchInputSchema = z
  .object({
    name: z.string().optional(),
    type: z.literal("email").optional(),
    config: notificationChannelConfigSchema
      .describe("Replaces both the confirmed and the pending addresses; addresses new to the channel wait for confirmation")
      .optional()
  })
  .refine(input => Object.keys(input).length > 0, { message: "Provide at least one field to update" });

export const notificationChannelConfirmationEmailInputSchema = z.object({
  address: z.string().email().describe("An address on the channel that waits for confirmation")
});

class NotificationChannelCreateInput extends createZodDto(z.object({ data: notificationChannelCreateInputSchema })) {}
class NotificationChannelPatchInput extends createZodDto(z.object({ data: notificationChannelPatchInputSchema })) {}
class NotificationChannelOutput extends createZodDto(notificationChannelOutputResponseSchema) {}
class NotificationChannelListQuery extends createZodDto(toPaginatedQuery()) {}
class NotificationChannelListOutput extends createZodDto(toPaginatedResponse(notificationChannelOutputSchema)) {}
class NotificationChannelCreateDefaultInput extends createZodDto(z.object({ data: notificationChannelCreateDefaultInputSchema })) {}
class NotificationChannelConfirmationEmailInput extends createZodDto(z.object({ data: notificationChannelConfirmationEmailInputSchema })) {}

type NotificationChannelData = NotificationChannelOutputResponse["data"];

@Controller({
  version: "1",
  path: "notification-channels"
})
export class NotificationChannelController {
  constructor(
    private readonly notificationChannelRepository: NotificationChannelRepository,
    private readonly alertRepository: AlertRepository,
    private readonly addressConfirmationService: AddressConfirmationService,
    private readonly authService: AuthService
  ) {}

  @Post()
  @ValidateHttp({
    201: {
      schema: NotificationChannelOutput,
      description: "Returns the created notification channel"
    }
  })
  async createNotificationChannel(@Body() { data }: NotificationChannelCreateInput): Promise<Result<NotificationChannelOutputResponse, NotFoundException>> {
    const requester = this.#requester();
    const addresses = splitAddresses(data.config.addresses, { confirmed: [], accountEmail: requester.accountEmail });
    const notificationChannel = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "create").create({
      ...data,
      config: { addresses: addresses.confirmed },
      isDefault: data.isDefault ?? false,
      userId: requester.userId,
      organizationId: this.authService.organizationId
    });

    await this.addressConfirmationService.requestConfirmations(notificationChannel, addresses.pending, requester);

    return Ok({ data: { ...notificationChannel, pendingAddresses: addresses.pending } });
  }

  @Post("default")
  @HttpCode(204)
  @ValidateHttp({})
  @ApiNoContentResponse({
    description:
      "Creates the default notification channel only if it doesn't exist, and otherwise updates its timezone when one is given. Either way, confirms the requester's verified email wherever it waits on their channels."
  })
  async createDefaultNotificationChannel(@Body() { data }: NotificationChannelCreateDefaultInput): Promise<Result<void, unknown>> {
    const requester = this.#requester();
    const addresses = splitAddresses(data.config.addresses, { confirmed: [], accountEmail: requester.accountEmail });
    const createdChannel = await this.notificationChannelRepository
      .accessibleBy(this.authService.ability, "create")
      .createDefaultChannel(
        { ...data, config: { addresses: addresses.confirmed }, userId: requester.userId, organizationId: this.authService.organizationId },
        this.authService.defaultChannelOwner
      );

    if (createdChannel) {
      await this.addressConfirmationService.requestConfirmations(createdChannel, addresses.pending, requester);
    }

    await this.addressConfirmationService.confirmVerifiedEmail(requester.userId, requester.accountEmail);

    return Ok(undefined);
  }

  @Get(":id")
  @ValidateHttp({
    200: {
      schema: NotificationChannelOutput,
      description: "Returns the requested notification channel by id"
    },
    404: {
      schema: NotFoundErrorResponse,
      description: "Returns 404 if the notification channel is not found"
    }
  })
  async getNotificationChannel(@Param("id", new ParseUUIDPipe()) id: string): Promise<Result<NotificationChannelOutputResponse, NotFoundException>> {
    const notificationChannel = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "read").findById(id);
    return this.#toResponse(notificationChannel);
  }

  @Get()
  @ValidateHttp({
    200: {
      schema: NotificationChannelListOutput,
      description: "Returns a paginated list of notification channels"
    }
  })
  // TODO: upgrade nestjs-zod to v5 and remove these defs
  //  Issue: https://github.com/BenLorantfy/nestjs-zod/issues/120
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number"
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of items per page"
  })
  async listNotificationChannels(@Query() query: NotificationChannelListQuery): Promise<Result<NotificationChannelListOutput, unknown>> {
    const page = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "read").paginate(query);

    return Ok({ ...page, data: await this.#withPendingAddresses(page.data) });
  }

  @Patch(":id")
  @ValidateHttp({
    200: { schema: NotificationChannelOutput, description: "Returns the updated notification channel" },
    404: { schema: NotFoundErrorResponse, description: "Returns 404 if the notification channel is not found" }
  })
  async updateNotificationChannel(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() { data }: NotificationChannelPatchInput
  ): Promise<Result<NotificationChannelOutputResponse, NotFoundException | BadRequestException>> {
    const repository = this.notificationChannelRepository.accessibleBy(this.authService.ability, "update");

    if (!data.config) {
      return this.#toResponse(await repository.updateById(id, data));
    }

    const requester = this.#requester();
    const config = data.config;
    const replacement = await repository.updateLocked(id, async (notificationChannel, tx) => {
      const pendingAddresses = (await this.addressConfirmationService.pendingAddressesOf([id], tx)).get(id) ?? [];
      const currentAddresses = [...notificationChannel.config.addresses, ...pendingAddresses];

      if (distinctAddresses(config.addresses).length > MAX_NOTIFICATION_CHANNEL_ADDRESSES && addsAddresses(currentAddresses, config.addresses)) {
        return Err(new BadRequestException(TOO_MANY_ADDRESSES_MESSAGE));
      }

      const addresses = splitAddresses(config.addresses, { confirmed: notificationChannel.config.addresses, accountEmail: requester.accountEmail });
      const updatedChannel = await repository.updateById(id, { ...data, config: { addresses: addresses.confirmed } }, tx);

      if (!updatedChannel) {
        return undefined;
      }

      await this.addressConfirmationService.forget(
        id,
        pendingAddresses.filter(address => !addresses.pending.includes(address)),
        tx
      );
      const confirmations = await this.addressConfirmationService.holdForConfirmation(
        id,
        addresses.pending.filter(address => !pendingAddresses.includes(address)),
        tx
      );

      return Ok({ channel: updatedChannel, pendingAddresses: addresses.pending, confirmations });
    });

    if (!replacement) {
      return this.#toResponse(undefined);
    }

    if (replacement.err) {
      return replacement;
    }

    const { channel, pendingAddresses, confirmations } = replacement.val;
    await this.addressConfirmationService.emailConfirmations(channel, confirmations, requester);

    return Ok({ data: { ...channel, pendingAddresses } });
  }

  @Post(":id/confirmation-emails")
  @HttpCode(204)
  @ValidateHttp({
    404: { schema: NotFoundErrorResponse, description: "Returns 404 if the channel is not found or the address doesn't wait for confirmation on it" },
    429: { schema: TooManyRequestsErrorResponse, description: "Returns 429 once the daily limit of confirmation emails is reached" }
  })
  @ApiNoContentResponse({ description: "Emails a new confirmation link to an address that waits for confirmation on the channel" })
  async createNotificationChannelConfirmationEmail(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() { data }: NotificationChannelConfirmationEmailInput
  ): Promise<Result<void, HttpException>> {
    const notificationChannel = await this.notificationChannelRepository.accessibleBy(this.authService.ability, "update").findById(id);

    if (!notificationChannel) {
      return Err(new NotFoundException("Notification channel not found"));
    }

    const result = await this.addressConfirmationService.resend(notificationChannel, data.address, this.#requester());

    if (result.ok) {
      return Ok(undefined);
    }

    return Err(
      result.val === "RATE_LIMITED"
        ? new HttpException(
            { message: "Too many confirmation emails were sent. Try again tomorrow.", code: "TOO_MANY_CONFIRMATION_EMAILS" },
            HttpStatus.TOO_MANY_REQUESTS
          )
        : new NotFoundException("The address doesn't wait for confirmation on this channel")
    );
  }

  @Delete(":id")
  @ValidateHttp({
    200: { schema: NotificationChannelOutput, description: "Returns the deleted notification channel" },
    404: { schema: NotFoundErrorResponse, description: "Returns 404 if the notification channel is not found" }
  })
  async deleteNotificationChannel(
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<Result<NotificationChannelOutputResponse, NotFoundException | BadRequestException>> {
    const deletableRepository = this.notificationChannelRepository.accessibleBy(this.authService.ability, "delete");

    if (!(await deletableRepository.findById(id))) {
      return this.#toResponse(undefined);
    }

    const count = await this.alertRepository.countActiveByNotificationChannelId(id);
    if (count > 0) {
      return Err(new BadRequestException("Cannot delete notification channel with alerts"));
    }

    const notificationChannel = await deletableRepository.deleteSafelyById(id);
    return this.#toResponse(notificationChannel);
  }

  #requester(): ConfirmationRequester {
    return { userId: this.authService.userId, accountEmail: this.authService.accountEmail };
  }

  async #withPendingAddresses(notificationChannels: RepoNotificationChannelOutput[]): Promise<NotificationChannelData[]> {
    const pendingAddresses = await this.addressConfirmationService.pendingAddressesOf(notificationChannels.map(channel => channel.id));

    return notificationChannels.map(channel => ({ ...channel, pendingAddresses: pendingAddresses.get(channel.id) ?? [] }));
  }

  async #toResponse(notificationChannel: RepoNotificationChannelOutput | undefined): Promise<Result<NotificationChannelOutputResponse, NotFoundException>> {
    if (!notificationChannel) {
      return Err(new NotFoundException("Notification channel not found"));
    }

    const [data] = await this.#withPendingAddresses([notificationChannel]);

    return Ok({ data });
  }
}

function addsAddresses(currentAddresses: string[], nextAddresses: string[]): boolean {
  const current = new Set(currentAddresses.map(normalizeAddress));

  return nextAddresses.some(address => !current.has(normalizeAddress(address)));
}
