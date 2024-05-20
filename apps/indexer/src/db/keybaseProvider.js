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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchValidatorKeybaseInfos = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const sequelize_1 = require("sequelize");
const base_1 = require("@akashnetwork/cloudmos-shared/dbSchemas/base");
function fetchValidatorKeybaseInfos() {
    return __awaiter(this, void 0, void 0, function* () {
        const validators = yield base_1.Validator.findAll({
            where: {
                identity: { [sequelize_1.Op.notIn]: [null, ""] }
            }
        });
        const requests = validators.map((validator) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                if (!/^[A-F0-9]{16}$/.test(validator.identity)) {
                    console.warn("Invalid identity " + validator.identity + " for validator " + validator.operatorAddress);
                    return Promise.resolve();
                }
                console.log("Fetching keybase info for " + validator.operatorAddress);
                const response = yield (0, node_fetch_1.default)(`https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validator.identity}`);
                if (response.status === 200) {
                    const data = yield response.json();
                    if (data.status.name === "OK" && data.them.length > 0) {
                        validator.keybaseUsername = (_a = data.them[0].basics) === null || _a === void 0 ? void 0 : _a.username;
                        validator.keybaseAvatarUrl = (_c = (_b = data.them[0].pictures) === null || _b === void 0 ? void 0 : _b.primary) === null || _c === void 0 ? void 0 : _c.url;
                        yield validator.save();
                    }
                }
                yield validator.save();
            }
            catch (err) {
                console.error("Error while fetching keybase info for " + validator.operatorAddress);
                throw err;
            }
        }));
        yield Promise.allSettled(requests);
    });
}
exports.fetchValidatorKeybaseInfos = fetchValidatorKeybaseInfos;
//# sourceMappingURL=keybaseProvider.js.map