import { Message, Validator } from "@akashnetwork/cloudmos-shared/dbSchemas/base";
import { MsgCreateValidator, MsgEditValidator } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import * as benchmark from "../shared/utils/benchmark";
import { Indexer } from "./indexer";
import { fromBase64, fromBech32, toBech32, toHex } from "@cosmjs/encoding";
import { IGenesis, IGenesisValidator, IGentxCreateValidator } from "@src/chain/genesisTypes";
import { pubkeyToRawAddress } from "@src/shared/utils/addresses";
import { sequelize } from "@src/db/dbConnection";
import { activeChain } from "@akashnetwork/cloudmos-shared/chainDefinitions";
import { Transaction as DbTransaction } from "sequelize";

export class ValidatorIndexer extends Indexer {
  msgHandlers: { [key: string]: (msgSubmitProposal: any, height: number, blockGroupTransaction: DbTransaction, msg: Message) => Promise<void> };

  constructor() {
    super();
    this.name = "ValidatorIndexer";
    this.msgHandlers = {
      "/cosmos.staking.v1beta1.MsgCreateValidator": this.handleCreateValidator,
      "/cosmos.staking.v1beta1.MsgEditValidator": this.handleEditValidator
    };
  }

  @benchmark.measureMethodAsync
  async dropTables(): Promise<void> {
    await Validator.drop();
  }

  async createTables(): Promise<void> {
    await Validator.sync({ force: false });
  }

  @benchmark.measureMethodAsync
  async seed(genesis: IGenesis) {
    const validators = genesis.app_state.staking.validators;

    await sequelize.transaction(async (dbTransaction) => {
      for (const validator of validators) {
        console.log("Creating validator :" + validator.operator_address);

        await this.createValidatorFromGenesis(validator, dbTransaction);
      }

      // TODO: Handle any gentx txs types
      const msgs = genesis.app_state.genutil.gen_txs
        .flatMap((tx) => tx.body.messages)
        .filter((x) => x["@type"] === "/cosmos.staking.v1beta1.MsgCreateValidator") as IGentxCreateValidator[];

      for (const msg of msgs) {
        console.log("Creating validator :" + msg.validator_address);

        await this.createValidatorFromGentx(msg, dbTransaction);
      }
    });
  }
  private async createValidatorFromGentx(validator: IGentxCreateValidator, dbTransaction: DbTransaction) {
    await Validator.create(
      {
        operatorAddress: validator.validator_address,
        accountAddress: toBech32(activeChain.bech32Prefix, fromBech32(validator.delegator_address).data),
        hexAddress: toHex(pubkeyToRawAddress(validator.pubkey["@type"], fromBase64(validator.pubkey.key))).toUpperCase(),
        moniker: validator.description.moniker,
        identity: validator.description.identity,
        website: validator.description.website,
        description: validator.description.details,
        securityContact: validator.description.security_contact,
        rate: parseFloat(validator.commission.rate),
        maxRate: parseFloat(validator.commission.max_rate),
        maxChangeRate: parseFloat(validator.commission.max_change_rate),
        minSelfDelegation: parseInt(validator.min_self_delegation)
      },
      { transaction: dbTransaction }
    );
  }

  private async createValidatorFromGenesis(validator: IGenesisValidator, dbTransaction: DbTransaction) {
    await Validator.create(
      {
        operatorAddress: validator.operator_address,
        accountAddress: toBech32(activeChain.bech32Prefix, fromBech32(validator.operator_address).data),
        hexAddress: toHex(pubkeyToRawAddress(validator.consensus_pubkey["@type"], fromBase64(validator.consensus_pubkey.key))).toUpperCase(),
        moniker: validator.description.moniker,
        identity: validator.description.identity,
        website: validator.description.website,
        description: validator.description.details,
        securityContact: validator.description.security_contact,
        rate: parseFloat(validator.commission.commission_rates.rate),
        maxRate: parseFloat(validator.commission.commission_rates.max_rate),
        maxChangeRate: parseFloat(validator.commission.commission_rates.max_change_rate),
        minSelfDelegation: parseInt(validator.min_self_delegation)
      },
      { transaction: dbTransaction }
    );
  }

  private async handleCreateValidator(decodedMessage: MsgCreateValidator, height: number, dbTransaction: DbTransaction, msg: Message) {
    const validatorInfo = {
      operatorAddress: decodedMessage.validatorAddress,
      accountAddress: decodedMessage.delegatorAddress,
      hexAddress: toHex(pubkeyToRawAddress(decodedMessage.pubkey.typeUrl, decodedMessage.pubkey.value.slice(2))).toUpperCase(),
      createdMsgId: msg?.id,
      moniker: decodedMessage.description.moniker,
      identity: decodedMessage.description.identity,
      website: decodedMessage.description.website,
      description: decodedMessage.description.details,
      securityContact: decodedMessage.description.securityContact,
      rate: parseFloat(decodedMessage.commission.rate),
      maxRate: parseFloat(decodedMessage.commission.maxRate),
      maxChangeRate: parseFloat(decodedMessage.commission.maxChangeRate),
      minSelfDelegation: parseInt(decodedMessage.minSelfDelegation)
    };

    const existingValidator = await Validator.findOne({ where: { operatorAddress: decodedMessage.validatorAddress }, transaction: dbTransaction });

    if (!existingValidator) {
      console.log(`Creating validator ${decodedMessage.validatorAddress}`);
      await Validator.create(validatorInfo, { transaction: dbTransaction });
    } else {
      console.log(`Updating validator ${decodedMessage.validatorAddress}`);
      await Validator.update(validatorInfo, { where: { operatorAddress: decodedMessage.validatorAddress }, transaction: dbTransaction });
    }
  }

  private async handleEditValidator(decodedMessage: MsgEditValidator, height: number, dbTransaction: DbTransaction, msg: Message) {
    const validator = await Validator.findOne({
      where: {
        operatorAddress: decodedMessage.validatorAddress
      },
      transaction: dbTransaction
    });

    if (!validator) throw new Error(`Validator not found: ${decodedMessage.validatorAddress}`);

    if (decodedMessage.description.moniker !== "[do-not-modify]") {
      validator.moniker = decodedMessage.description.moniker;
    }
    if (decodedMessage.description.identity !== "[do-not-modify]") {
      validator.identity = decodedMessage.description.identity;
    }
    if (decodedMessage.description.website !== "[do-not-modify]") {
      validator.website = decodedMessage.description.website;
    }
    if (decodedMessage.description.details !== "[do-not-modify]") {
      validator.description = decodedMessage.description.details;
    }
    if (decodedMessage.description.securityContact !== "[do-not-modify]") {
      validator.securityContact = decodedMessage.description.securityContact;
    }
    if (decodedMessage.commissionRate) {
      validator.rate = parseFloat(decodedMessage.commissionRate);
    }
    if (decodedMessage.minSelfDelegation) {
      validator.minSelfDelegation = parseInt(decodedMessage.minSelfDelegation);
    }

    await validator.save({ transaction: dbTransaction });
  }
}
