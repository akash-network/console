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
exports.getCachedBlockResultsByHeight = exports.getCachedBlockByHeight = exports.deleteCache = exports.getCacheSize = exports.getLatestHeightInCache = exports.blockResultsDb = exports.blocksDb = exports.blockHeightToKey = void 0;
const level_1 = require("level");
const fs_1 = __importDefault(require("fs"));
const files_1 = require("@src/shared/utils/files");
const constants_1 = require("@src/shared/constants");
const path = require("path");
const LevelNotFoundCode = "LEVEL_NOT_FOUND";
if (!fs_1.default.existsSync(constants_1.dataFolderPath)) {
    fs_1.default.mkdirSync(constants_1.dataFolderPath, { recursive: true });
}
const blockHeightToKey = (height) => height.toString().padStart(10, "0");
exports.blockHeightToKey = blockHeightToKey;
exports.blocksDb = new level_1.Level(constants_1.dataFolderPath + "/blocks.db");
exports.blockResultsDb = new level_1.Level(constants_1.dataFolderPath + "/blockResults.db");
function getLatestHeightInCache() {
    return __awaiter(this, void 0, void 0, function* () {
        const reverseKeyIterator = exports.blocksDb.keys({ reverse: true });
        const keyStr = yield reverseKeyIterator.next();
        yield reverseKeyIterator.close();
        if (keyStr) {
            return parseInt(keyStr);
        }
        else {
            return 0;
        }
    });
}
exports.getLatestHeightInCache = getLatestHeightInCache;
const getCacheSize = function () {
    return __awaiter(this, void 0, void 0, function* () {
        console.time("size");
        const blocksSize = yield getTotalSize(constants_1.dataFolderPath + "/blocks.db");
        const blockResultsSize = yield getTotalSize(constants_1.dataFolderPath + "/blockResults.db");
        console.timeEnd("size");
        return { blocksSize: blocksSize, blockResultsSize: blockResultsSize };
    });
};
exports.getCacheSize = getCacheSize;
const deleteCache = function () {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Deleting cache...");
        yield exports.blocksDb.clear();
        yield exports.blockResultsDb.clear();
        console.log("Deleted");
    });
};
exports.deleteCache = deleteCache;
function getCachedBlockByHeight(height) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const content = yield exports.blocksDb.get((0, exports.blockHeightToKey)(height));
            return JSON.parse(content);
        }
        catch (err) {
            if (err.code !== LevelNotFoundCode)
                throw err;
            return null;
        }
    });
}
exports.getCachedBlockByHeight = getCachedBlockByHeight;
function getCachedBlockResultsByHeight(height) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const content = yield exports.blockResultsDb.get((0, exports.blockHeightToKey)(height));
            return JSON.parse(content);
        }
        catch (err) {
            if (err.code !== LevelNotFoundCode)
                throw err;
            return null;
        }
    });
}
exports.getCachedBlockResultsByHeight = getCachedBlockResultsByHeight;
const getAllFiles = function (dirPath, arrayOfFiles) {
    const files = fs_1.default.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function (file) {
        if (fs_1.default.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        }
        else {
            arrayOfFiles.push(path.join(dirPath, file));
        }
    });
    return arrayOfFiles;
};
const getTotalSize = function (directoryPath) {
    const arrayOfFiles = getAllFiles(directoryPath);
    let totalSize = 0;
    arrayOfFiles.forEach(function (filePath) {
        totalSize += fs_1.default.statSync(filePath).size;
    });
    return (0, files_1.bytesToHumanReadableSize)(totalSize);
};
//# sourceMappingURL=dataStore.js.map