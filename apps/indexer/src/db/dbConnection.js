"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const pg_1 = __importDefault(require("pg"));
const sequelize_1 = require("sequelize");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const sequelize_typescript_1 = require("sequelize-typescript");
const dbSchemas_1 = require("@akashnetwork/cloudmos-shared/dbSchemas");
pg_1.default.defaults.parseInt8 = true;
exports.sequelize = new sequelize_typescript_1.Sequelize(chainDefinitions_1.activeChain.connectionString, {
    dialectModule: pg_1.default,
    logging: false,
    transactionType: sequelize_1.Transaction.TYPES.IMMEDIATE,
    define: {
        timestamps: false,
        freezeTableName: true
    },
    models: dbSchemas_1.chainModels
});
//# sourceMappingURL=dbConnection.js.map