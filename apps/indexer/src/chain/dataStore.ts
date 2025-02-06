import { LoggerService } from "@akashnetwork/logging";
import fs from "fs";
import { Level } from "level";
import path from "path";

import { dataFolderPath } from "@src/shared/constants";
import { bytesToHumanReadableSize } from "@src/shared/utils/files";

const LevelNotFoundCode = "LEVEL_NOT_FOUND";
const logger = LoggerService.forContext("DataStore");

if (!fs.existsSync(dataFolderPath)) {
  fs.mkdirSync(dataFolderPath, { recursive: true });
}

export const blockHeightToKey = (height: number) => height.toString().padStart(10, "0");

export const blocksDb = new Level(dataFolderPath + "/blocks.db");
export const blockResultsDb = new Level(dataFolderPath + "/blockResults.db");

export async function getLatestHeightInCache() {
  const reverseKeyIterator = blocksDb.keys({ reverse: true });
  const keyStr = await reverseKeyIterator.next();
  await reverseKeyIterator.close();

  if (keyStr) {
    return parseInt(keyStr);
  } else {
    return 0;
  }
}

export const getCacheSize = async function () {
  console.time("size");
  const blocksSize = await getTotalSize(dataFolderPath + "/blocks.db");
  const blockResultsSize = await getTotalSize(dataFolderPath + "/blockResults.db");
  console.timeEnd("size");
  return { blocksSize: blocksSize, blockResultsSize: blockResultsSize };
};

export const deleteCache = async function () {
  logger.info("Deleting cache...");
  await blocksDb.clear();
  await blockResultsDb.clear();
  logger.info("Deleted");
};

export async function getCachedBlockByHeight(height: number) {
  try {
    const content = await blocksDb.get(blockHeightToKey(height));
    return JSON.parse(content);
  } catch (err) {
    if (err.code !== LevelNotFoundCode) throw err;

    return null;
  }
}

export async function getCachedBlockResultsByHeight(height: number) {
  try {
    const content = await blockResultsDb.get(blockHeightToKey(height));
    return JSON.parse(content);
  } catch (err) {
    if (err.code !== LevelNotFoundCode) throw err;

    return null;
  }
}

const getAllFiles = function (dirPath, arrayOfFiles?) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
};

const getTotalSize = function (directoryPath) {
  const arrayOfFiles = getAllFiles(directoryPath);

  let totalSize = 0;

  arrayOfFiles.forEach(function (filePath) {
    totalSize += fs.statSync(filePath).size;
  });

  return bytesToHumanReadableSize(totalSize);
};
