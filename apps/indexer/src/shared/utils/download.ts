import { LoggerService } from "@akashnetwork/logging";
import fs from "fs";
import http from "https";
import { basename } from "path";

import { bytesToHumanReadableSize } from "./files";

const progressLogThrottle = 1000;
const logger = LoggerService.forContext("Download");

export async function download(url: string, path: string) {
  const uri = new URL(url);
  if (!path) {
    path = basename(uri.pathname);
  }
  const file = fs.createWriteStream(path);

  return new Promise<void>(function (resolve, reject) {
    http.get(uri.href).on("response", function (res) {
      const len = parseInt(res.headers["content-length"], 10);
      let downloaded = 0;
      let lastProgressLog = Date.now();
      res
        .on("data", function (chunk) {
          file.write(chunk);
          downloaded += chunk.length;
          const percent = ((100.0 * downloaded) / len).toFixed(2);
          if (Date.now() - lastProgressLog > progressLogThrottle) {
            logger.info(`${uri.pathname} - Downloading ${percent}% ${bytesToHumanReadableSize(downloaded)}`);
            lastProgressLog = Date.now();
          }
        })
        .on("end", function () {
          file.end();
          logger.info(`${uri.pathname} downloaded to: ${path}`);
          resolve();
        })
        .on("error", function (err) {
          reject(err);
        });
    });
  });
}
