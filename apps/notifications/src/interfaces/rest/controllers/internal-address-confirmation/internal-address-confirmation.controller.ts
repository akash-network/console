import { BadRequestException, Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import { ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { Unprotected } from "@src/interfaces/rest/interceptors/auth/auth.interceptor";
import { AddressConfirmationService } from "@src/modules/notifications/services/address-confirmation/address-confirmation.service";

class AddressConfirmationInput extends createZodDto(
  z.object({
    token: z.string().min(1).describe("The token of the confirmation link emailed to the address")
  })
) {}

@ApiTags("Internal/AddressConfirmation")
@Controller({ path: "internal/v1/address-confirmations" })
@Unprotected()
export class InternalAddressConfirmationController {
  constructor(private readonly addressConfirmationService: AddressConfirmationService) {}

  @Post()
  @HttpCode(204)
  @ValidateHttp({})
  @ApiNoContentResponse({ description: "Confirms the address a confirmation link was emailed to, which then receives its channel's alerts" })
  async confirmAddress(@Body() { token }: AddressConfirmationInput): Promise<Result<void, BadRequestException>> {
    if (await this.addressConfirmationService.confirm(token)) {
      return Ok(undefined);
    }

    return Err(new BadRequestException({ message: "The confirmation link is invalid or was already used", code: "INVALID_CONFIRMATION_LINK" }));
  }
}
