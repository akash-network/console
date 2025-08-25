import { CosmosHttpService, type RestCosmosStakingValidatorResponse } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { GetValidatorByAddressResponse, GetValidatorListResponse } from "@src/validator/http-schemas/validator.schema";
import { ValidatorRepository } from "@src/validator/repositories/validator/validator.repository";

@singleton()
export class ValidatorService {
  constructor(
    private readonly cosmosHttpService: CosmosHttpService,
    private readonly validatorRepository: ValidatorRepository
  ) {}

  public async list(): Promise<GetValidatorListResponse> {
    const response = await this.cosmosHttpService.getValidatorList();
    const validators = response.validators.map(x => ({
      operatorAddress: x.operator_address,
      moniker: x.description.moniker.trim(),
      votingPower: parseInt(x.tokens),
      commission: parseFloat(x.commission.commission_rates.rate),
      identity: x.description.identity
    }));
    const totalVotingPower = validators.reduce((acc, cur) => acc + cur.votingPower, 0);
    const validatorsFromDb = await this.validatorRepository.findAllWithAvatarUrl();
    const avatarMap = new Map(validatorsFromDb.map(v => [v.operatorAddress, v.keybaseAvatarUrl]));

    const sortedValidators = validators
      .sort((a, b) => b.votingPower - a.votingPower)
      .map((x, i) => ({
        ...x,
        votingPowerRatio: x.votingPower / totalVotingPower,
        rank: i + 1,
        keybaseAvatarUrl: avatarMap.get(x.operatorAddress) ?? null
      }));

    return sortedValidators;
  }

  public async getByAddress(address: string): Promise<GetValidatorByAddressResponse | null> {
    let cosmosResponse: RestCosmosStakingValidatorResponse;
    try {
      cosmosResponse = await this.cosmosHttpService.getValidatorByAddress(address);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }

      throw error;
    }

    const validatorsResponse = await this.cosmosHttpService.getValidatorList();
    const validatorFromDb = await this.validatorRepository.findByAddress(address);
    const validatorRank = validatorsResponse.validators
      .map(x => {
        return { votingPower: parseInt(x.tokens), address: x.operator_address };
      })
      .sort((a, b) => b.votingPower - a.votingPower)
      .findIndex(x => x.address === address);

    return {
      operatorAddress: cosmosResponse.validator.operator_address,
      address: validatorFromDb?.accountAddress ?? null,
      moniker: cosmosResponse.validator.description.moniker,
      keybaseUsername: validatorFromDb?.keybaseUsername ?? null,
      keybaseAvatarUrl: validatorFromDb?.keybaseAvatarUrl ?? null,
      votingPower: parseInt(cosmosResponse.validator.tokens),
      commission: parseFloat(cosmosResponse.validator.commission.commission_rates.rate),
      maxCommission: parseFloat(cosmosResponse.validator.commission.commission_rates.max_rate),
      maxCommissionChange: parseFloat(cosmosResponse.validator.commission.commission_rates.max_change_rate),
      identity: cosmosResponse.validator.description.identity,
      description: cosmosResponse.validator.description.details,
      website: cosmosResponse.validator.description.website,
      rank: validatorRank + 1
    };
  }
}
