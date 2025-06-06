import { singleton } from "tsyringe";

import { GetValidatorByAddressResponse, GetValidatorListResponse } from "@src/validator/http-schemas/validator.schema";
import { ValidatorService } from "@src/validator/services/validator/validator.service";

@singleton()
export class ValidatorController {
  constructor(private readonly validatorService: ValidatorService) {}

  async getValidatorList(): Promise<GetValidatorListResponse> {
    return await this.validatorService.list();
  }

  async getValidatorByAddress(address: string): Promise<GetValidatorByAddressResponse> {
    return await this.validatorService.getByAddress(address);
  }
}
