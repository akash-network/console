"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexersMsgTypes = exports.activeIndexers = exports.indexers = void 0;
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const akashStatsIndexer_1 = require("./akashStatsIndexer");
const messageAddressesIndexer_1 = require("./messageAddressesIndexer");
const validatorIndexer_1 = require("./validatorIndexer");
const validatorIndexer = new validatorIndexer_1.ValidatorIndexer();
const messageAddressesIndexer = new messageAddressesIndexer_1.MessageAddressesIndexer();
const customIndexers = [new akashStatsIndexer_1.AkashStatsIndexer()].filter((x) => chainDefinitions_1.activeChain.customIndexers.includes(x.name));
exports.indexers = chainDefinitions_1.activeChain.startHeight
    ? [...customIndexers, messageAddressesIndexer]
    : [...customIndexers, validatorIndexer, messageAddressesIndexer];
exports.activeIndexers = [...exports.indexers];
exports.indexersMsgTypes = exports.activeIndexers.reduce((previous, current) => previous.concat(Object.keys(current.msgHandlers)), []);
//# sourceMappingURL=index.js.map