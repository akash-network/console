"use strict";
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
exports.initDatabase = void 0;
const constants_1 = require("@src/shared/constants");
const indexers_1 = require("@src/indexers");
const genesisImporter_1 = require("@src/chain/genesisImporter");
const dbConnection_1 = require("./dbConnection");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
const dbSchemas_1 = require("@akashnetwork/cloudmos-shared/dbSchemas");
const monitoredValue_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base/monitoredValue");
/**
 * Initiate database schema
 */
const initDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Connecting to db (${dbConnection_1.sequelize.config.host}/${dbConnection_1.sequelize.config.database})...`);
    yield dbConnection_1.sequelize.authenticate();
    console.log("Connection has been established successfully.");
    if (constants_1.executionMode === constants_1.ExecutionMode.RebuildAll) {
        yield base_1.Day.drop({ cascade: true });
        yield dbSchemas_1.Message.drop({ cascade: true });
        yield base_1.Transaction.drop({ cascade: true });
        yield dbSchemas_1.Block.drop({ cascade: true });
    }
    yield dbSchemas_1.Block.sync();
    yield base_1.Transaction.sync();
    yield dbSchemas_1.Message.sync();
    yield base_1.Day.sync();
    yield monitoredValue_1.MonitoredValue.sync();
    for (const indexer of indexers_1.indexers) {
        if (constants_1.executionMode === constants_1.ExecutionMode.RebuildAll) {
            yield indexer.recreateTables();
        }
        else {
            yield indexer.createTables();
        }
    }
    // If we are syncing from the first block and this is the first time syncing, seed the database with the genesis file
    if (!chainDefinitions_1.activeChain.startHeight) {
        const firstBlock = yield dbSchemas_1.Block.findOne();
        if (!firstBlock) {
            console.log("First time syncing, seeding from genesis file...");
            const genesis = yield (0, genesisImporter_1.getGenesis)();
            for (const indexer of indexers_1.indexers) {
                yield indexer.seed(genesis);
            }
        }
    }
});
exports.initDatabase = initDatabase;
//# sourceMappingURL=buildDatabase.js.map