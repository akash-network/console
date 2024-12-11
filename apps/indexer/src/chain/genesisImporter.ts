import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { LoggerService } from "@akashnetwork/logging";
import fs from "fs";
import { ungzip } from "node-gzip";
import path from "path";

import { dataFolderPath } from "@src/shared/constants";
import { download } from "@src/shared/utils/download";
import { IGenesis } from "./genesisTypes";

const logger = LoggerService.forContext("GenesisImports");

export async function getGenesis(): Promise<IGenesis> {
  const ext = path.extname(activeChain.genesisFileUrl);
  const filename = path.basename(activeChain.genesisFileUrl);

  let genesisLocalPath = dataFolderPath + "/" + filename;

  if (!fs.existsSync(genesisLocalPath)) {
    logger.info("Downloading genesis file: " + activeChain.genesisFileUrl);
    await download(activeChain.genesisFileUrl, genesisLocalPath);
  }

  if (ext === ".gz") {
    logger.info("Extracting genesis file...");
    const decompressed = await ungzip(fs.readFileSync(genesisLocalPath).buffer);
    genesisLocalPath = genesisLocalPath.replace(".gz", "");
    fs.writeFileSync(genesisLocalPath, decompressed);
  }

  const fileContent = await fs.promises.readFile(genesisLocalPath, { encoding: "utf-8" });
  return JSON.parse(fileContent) as IGenesis;
}
