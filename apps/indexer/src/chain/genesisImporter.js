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
exports.getGenesis = void 0;
const fs_1 = __importDefault(require("fs"));
const download_1 = require("@src/shared/utils/download");
const constants_1 = require("@src/shared/constants");
const chainDefinitions_1 = require("@akashnetwork/cloudmos-shared/chainDefinitions");
const path_1 = __importDefault(require("path"));
const node_gzip_1 = require("node-gzip");
function getGenesis() {
    return __awaiter(this, void 0, void 0, function* () {
        const ext = path_1.default.extname(chainDefinitions_1.activeChain.genesisFileUrl);
        const filename = path_1.default.basename(chainDefinitions_1.activeChain.genesisFileUrl);
        let genesisLocalPath = constants_1.dataFolderPath + "/" + filename;
        if (!fs_1.default.existsSync(genesisLocalPath)) {
            console.log("Downloading genesis file: " + chainDefinitions_1.activeChain.genesisFileUrl);
            yield (0, download_1.download)(chainDefinitions_1.activeChain.genesisFileUrl, genesisLocalPath);
        }
        if (ext === ".gz") {
            console.log("Extracting genesis file...");
            const decompressed = yield (0, node_gzip_1.ungzip)(fs_1.default.readFileSync(genesisLocalPath).buffer);
            genesisLocalPath = genesisLocalPath.replace(".gz", "");
            fs_1.default.writeFileSync(genesisLocalPath, decompressed);
        }
        const fileContent = yield fs_1.default.promises.readFile(genesisLocalPath, { encoding: "utf-8" });
        return JSON.parse(fileContent);
    });
}
exports.getGenesis = getGenesis;
//# sourceMappingURL=genesisImporter.js.map