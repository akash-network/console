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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
exports.Indexer = void 0;
const benchmark = __importStar(require("@src/shared/utils/benchmark"));
class Indexer {
    initCache(firstBlockHeight) {
        return Promise.resolve();
    }
    hasHandlerForType(type) {
        return Object.keys(this.msgHandlers).includes(type);
    }
    processMessage(decodedMessage, height, blockGroupTransaction, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(msg.type in this.msgHandlers)) {
                throw new Error(`No handler for message type ${msg.type} in ${this.name}`);
            }
            yield benchmark.measureAsync(this.name + " " + msg.type, () => __awaiter(this, void 0, void 0, function* () {
                yield this.msgHandlers[msg.type].bind(this)(decodedMessage, height, blockGroupTransaction, msg);
            }));
        });
    }
    dropTables() {
        return Promise.resolve();
    }
    createTables() {
        return Promise.resolve();
    }
    recreateTables() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.dropTables();
            yield this.createTables();
        });
    }
    seed(genesis) {
        return Promise.resolve();
    }
    afterEveryBlock(currentBlock, previousBlock, dbTransaction) {
        return Promise.resolve();
    }
    afterEveryTransaction(rawTx, currentTransaction, dbTransaction) {
        return Promise.resolve();
    }
}
exports.Indexer = Indexer;
//# sourceMappingURL=indexer.js.map