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
exports.MessageAddressesIndexer = void 0;
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
const benchmark = __importStar(require("../shared/utils/benchmark"));
const indexer_1 = require("./indexer");
const encoding_1 = require("@cosmjs/encoding");
const proto_signing_1 = require("@cosmjs/proto-signing");
const addresses_1 = require("@src/shared/utils/addresses");
const coin_1 = require("@src/shared/utils/coin");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
class MessageAddressesIndexer extends indexer_1.Indexer {
    constructor() {
        super();
        this.name = "MessageAddressesIndexer";
        this.processFailedTxs = true;
        this.msgHandlers = {
            "/cosmos.bank.v1beta1.MsgSend": this.handleMsgSend,
            "/cosmos.distribution.v1beta1.MsgFundCommunityPool": this.handleMsgFundCommunityPool,
            "/cosmos.gov.v1beta1.MsgDeposit": this.handleMsgDeposit,
            "/cosmos.staking.v1beta1.MsgBeginRedelegate": this.handleMsgBeginRedelegate,
            "/cosmos.staking.v1beta1.MsgDelegate": this.handleMsgDelegate,
            "/cosmos.staking.v1beta1.MsgUndelegate": this.handleMsgUndelegate,
            "/cosmos.bank.v1beta1.MsgMultiSend": this.handleMsgMultiSend
        };
    }
    dropTables() {
        return __awaiter(this, void 0, void 0, function* () {
            yield base_1.AddressReference.drop();
        });
    }
    createTables() {
        return __awaiter(this, void 0, void 0, function* () {
            yield base_1.AddressReference.sync({ force: false });
        });
    }
    handleMsgSend(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield base_1.AddressReference.bulkCreate([
                {
                    messageId: msg.id,
                    transactionId: msg.txId,
                    address: decodedMessage.fromAddress,
                    type: "Sender"
                },
                {
                    messageId: msg.id,
                    transactionId: msg.txId,
                    address: decodedMessage.toAddress,
                    type: "Receiver"
                }
            ], { transaction: dbTransaction });
            msg.amount = (0, coin_1.getAmountFromCoinArray)(decodedMessage.amount, "uakt");
        });
    }
    handleMsgMultiSend(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const senders = decodedMessage.inputs.map((input) => ({
                messageId: msg.id,
                transactionId: msg.txId,
                address: input.address,
                type: "Sender"
            }));
            const receivers = decodedMessage.outputs.map((output) => ({
                messageId: msg.id,
                transactionId: msg.txId,
                address: output.address,
                type: "Receiver"
            }));
            yield base_1.AddressReference.bulkCreate([...senders, ...receivers], { transaction: dbTransaction });
        });
    }
    handleMsgFundCommunityPool(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            msg.amount = (0, coin_1.getAmountFromCoinArray)(decodedMessage.amount, "uakt");
        });
    }
    handleMsgDeposit(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            msg.amount = (0, coin_1.getAmountFromCoinArray)(decodedMessage.amount, "uakt");
        });
    }
    handleMsgBeginRedelegate(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            msg.amount = (0, coin_1.getAmountFromCoin)(decodedMessage.amount, "uakt");
        });
    }
    handleMsgDelegate(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            msg.amount = (0, coin_1.getAmountFromCoin)(decodedMessage.amount, "uakt");
        });
    }
    handleMsgUndelegate(decodedMessage, height, dbTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            msg.amount = (0, coin_1.getAmountFromCoin)(decodedMessage.amount, "uakt");
        });
    }
    afterEveryTransaction(rawTx, currentTransaction, dbTransaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const { multisigThreshold, addresses } = this.getTransactionSignerAddresses(rawTx, currentTransaction.hash);
            currentTransaction.multisigThreshold = multisigThreshold;
            yield base_1.AddressReference.bulkCreate(addresses.map((address) => ({
                messageId: null,
                transactionId: currentTransaction.id,
                address: address,
                type: "Signer"
            })), { transaction: dbTransaction });
        });
    }
    getTransactionSignerAddresses(tx, hash) {
        const signerInfos = tx.authInfo.signerInfos;
        if (signerInfos.length !== 1) {
            console.warn("More than one signer in tx: " + hash);
        }
        let multisigThreshold = null;
        let addresses = [];
        for (const signerInfo of signerInfos) {
            if (!signerInfo.publicKey)
                continue;
            try {
                const pubkey = (0, proto_signing_1.decodePubkey)(signerInfo.publicKey);
                if (pubkey.type === "tendermint/PubKeySecp256k1") {
                    const pubKeyBuffer = Buffer.from(pubkey.value, "base64");
                    addresses.push((0, encoding_1.toBech32)(chainDefinitions_1.activeChain.bech32Prefix, (0, addresses_1.rawSecp256k1PubkeyToRawAddress)(pubKeyBuffer)));
                }
                else if (pubkey.type === "tendermint/PubKeyMultisigThreshold") {
                    multisigThreshold = pubkey.value.threshold;
                    addresses = addresses.concat(pubkey.value.pubkeys.map((p) => {
                        const pubKeyBuffer = Buffer.from(p.value, "base64");
                        return (0, encoding_1.toBech32)(chainDefinitions_1.activeChain.bech32Prefix, (0, addresses_1.rawSecp256k1PubkeyToRawAddress)(pubKeyBuffer));
                    }));
                }
                else {
                    throw "Unrecognized pubkey type: " + JSON.stringify(pubkey);
                }
            }
            catch (e) {
                // TEMPORARY FIX FOR TX 63CBF2B5C23E30B774F5072F625E3400603C95B993F0428E375F8078EAC95B17
                if (signerInfo.publicKey.typeUrl === "/cosmos.crypto.multisig.LegacyAminoPubKey") {
                    console.log("FAILED TO DECODE MULTISIG PUBKEY: ", hash);
                    return { multisigThreshold: null, addresses: [] };
                }
                throw e;
            }
        }
        return { multisigThreshold, addresses };
    }
}
__decorate([
    benchmark.measureMethodAsync,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MessageAddressesIndexer.prototype, "dropTables", null);
exports.MessageAddressesIndexer = MessageAddressesIndexer;
//# sourceMappingURL=messageAddressesIndexer.js.map