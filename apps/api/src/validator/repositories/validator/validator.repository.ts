import { Validator } from "@akashnetwork/database/dbSchemas/base";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

@singleton()
export class ValidatorRepository {
  async findAll(): Promise<Validator[]> {
    return await Validator.findAll();
  }

  async findAllWithAvatarUrl(): Promise<Validator[]> {
    return await Validator.findAll({
      where: {
        keybaseAvatarUrl: { [Op.not]: null, [Op.ne]: "" }
      }
    });
  }

  async findByAddress(address: string): Promise<Validator | null> {
    return await Validator.findOne({ where: { operatorAddress: address } });
  }

  async findByAccountAddress(address: string): Promise<Validator | null> {
    return await Validator.findOne({ where: { accountAddress: address } });
  }
}
