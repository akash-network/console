"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorIndexer = void 0;
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
const benchmark = __importStar(require("../shared/utils/benchmark"));
const indexer_1 = require("./indexer");
const encoding_1 = require("@cosmjs/encoding");
const addresses_1 = require("@src/shared/utils/addresses");
const dbConnection_1 = require("@src/db/dbConnection");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
class ValidatorIndexer extends indexer_1.Indexer {
    constructor() {
        super();
        this.name = "ValidatorIndexer";
        this.msgHandlers = {
            "/cosmos.staking.v1beta1.MsgCreateValidator": this.handleCreateValidator,
            "/cosmos.staking.v1beta1.MsgEditValidator": this.handleEditValidator
        };
    }
    dropTables() {
        return __awaiter(this, void 0, void 0, function* () {
            yield base_1.Validator.drop();
        });
    }
    createTables() {
        return __awaiter(this, void 0, void 0, function* () {
            yield base_1.Validator.sync({ force: false });
        });
    }
    seed(genesis) {
        return __awaiter(this, void 0, void 0, function* () {
            const validators = genesis.app_state.staking.validators;
            yield dbConnection_1.sequelize.transaction((dbTransaction) => __awaiter(this, void 0, void 0, function* () {
                for (const validator of validators) {
                    console.log("Creating validator :" + validator.operator_address);
                    yield this.createValidatorFromGenesis(validator, dbTransaction);
                }
                // TODO: Handle any gentx txs types
                const msgs = genesis.app_state.genutil.gen_txs
                    .flatMap((tx) => tx.body.messages)
                    .filter((x) => x["@type"] === "/cosmos.staking.v1beta1.MsgCreateValidator");
                for (const msg of msgs) {
                    console.log("Creating validator :" + msg.validator_address);
                    yield this.createValidatorFromGentx(msg, dbTransaction);
                }
            }));
        });
    }
    createValidatorFromGentx(validator, dbTransaction) {
        return __awaiter(this, void 0, void 0, function* () {
            yield base_1.Validator.create({
                operatorAddress: validator.validator_address,
                accountAddress: (0, encoding_1.toBech32)(chainDefinitions_1.activeChain.bech32Prefix, (0, encoding_1.fromBech32)(validator.delegator_address).data),
                hexAddress: (0, encoding_1.toHex)((0, addresses_1.pubkeyToRawAddress)(validator.pubkey["@type"], (0, encoding_1.fromBase64)(validator.pubkey.key))).toUpperCase(),
                moniker: validator.description.moniker,
                identity: validator.description.identity,
                website: validator.description.website,
                description: validator.description.details,
                securityContact: validator.description.security_contact,
                rate: parseFloat(validator.commission.rate),
                maxRate: parseFloat(validator.commission.max_rate),
                maxChangeRate: parseFloat(validator.commission.max_change_rate),
                minSelfDelegation: parseInt(validator.min_self_delegation)
            }, { transaction: dbTransaction });
        });
    }
    createValidatorFromGenesis(validator, dbTransaction) {
        return __awaiter(this, void 0, void 0, function* () {
            yield base_1.Validator.create({
                operatorAddress: validator.operator_address,
                accountAddress: (0, encoding_1.toBech32)(chainDefinitions_1.activeChain.bech32Prefix, (0, encoding_1.fromBech32)(validator.operator_address).data),
                hexAddress: (0, encoding_1.toHex)((0, addresses_1.pubkeyToRawAddress)(validator.consensus_pubkey["@type"], (0, encoding_1.fromBase64)(validator.consensus_pubkey.key))).toUpperCase(),
                moniker: validator.description.moniker,
                identity: validator.description.identity,
                website: validator.description.website,
                description: validator.description.details,
                securityContact: validator.description.security_contact,
                rate: parseFloat(validator.commission.commission_rates.rate),
                maxRate: parseFloat(validator.commission.commission_rates.max_rate),
                maxChangeRate: parseFloat(validator.commission.commission_rates.max_change_rate),
                minSelfDelegation: parseInt(validator.min_self_delegation)
            }, { transaction: dbTransaction });
        });
    }
    handleCreateValidator(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const validatorInfo = {
                operatorAddress: decodedMessage.validatorAddress,
                accountAddress: decodedMessage.delegatorAddress,
                hexAddress: (0, encoding_1.toHex)((0, addresses_1.pubkeyToRawAddress)(decodedMessage.pubkey.typeUrl, decodedMessage.pubkey.value.slice(2))).toUpperCase(),
                createdMsgId: msg === null || msg === void 0 ? void 0 : msg.id,
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
            const existingValidator = yield base_1.Validator.findOne({ where: { operatorAddress: decodedMessage.validatorAddress }, transaction: dbTransaction });
            if (!existingValidator) {
                console.log(`Creating validator ${decodedMessage.validatorAddress}`);
                yield base_1.Validator.create(validatorInfo, { transaction: dbTransaction });
            }
            else {
                console.log(`Updating validator ${decodedMessage.validatorAddress}`);
                yield base_1.Validator.update(validatorInfo, { where: { operatorAddress: decodedMessage.validatorAddress }, transaction: dbTransaction });
            }
        });
    }
    handleEditValidator(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const validator = yield base_1.Validator.findOne({
                where: {
                    operatorAddress: decodedMessage.validatorAddress
                },
                transaction: dbTransaction
            });
            if (!validator)
                throw new Error(`Validator not found: ${decodedMessage.validatorAddress}`);
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
            yield validator.save({ transaction: dbTransaction });
        });
    }
}
__decorate([
    benchmark.measureMethodAsync,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ValidatorIndexer.prototype, "dropTables", null);
__decorate([
    benchmark.measureMethodAsync,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ValidatorIndexer.prototype, "seed", null);
exports.ValidatorIndexer = ValidatorIndexer;
//# sourceMappingURL=validatorIndexer.js.map