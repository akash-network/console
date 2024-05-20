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
exports.download = void 0;
const files_1 = require("./files");
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const progressLogThrottle = 1000;
function download(url, path) {
    return __awaiter(this, void 0, void 0, function* () {
        const uri = new URL(url);
        if (!path) {
            path = (0, path_1.basename)(uri.pathname);
        }
        const file = fs_1.default.createWriteStream(path);
        return new Promise(function (resolve, reject) {
            https_1.default.get(uri.href).on("response", function (res) {
                const len = parseInt(res.headers["content-length"], 10);
                let downloaded = 0;
                let lastProgressLog = Date.now();
                res
                    .on("data", function (chunk) {
                    file.write(chunk);
                    downloaded += chunk.length;
                    const percent = ((100.0 * downloaded) / len).toFixed(2);
                    if (Date.now() - lastProgressLog > progressLogThrottle) {
                        console.log(`${uri.pathname} - Downloading ${percent}% ${(0, files_1.bytesToHumanReadableSize)(downloaded)}`);
                        lastProgressLog = Date.now();
                    }
                })
                    .on("end", function () {
                    file.end();
                    console.log(`${uri.pathname} downloaded to: ${path}`);
                    resolve();
                })
                    .on("error", function (err) {
                    reject(err);
                });
            });
        });
    });
}
exports.download = download;
//# sourceMappingURL=download.js.map