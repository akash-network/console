import { activeChain } from "@akashnetwork/cloudmos-shared/chainDefinitions";
import fs from "fs";
import { ungzip } from "node-gzip";
import path from "path";

import { dataFolderPath } from "@src/shared/constants";
import { download } from "@src/shared/utils/download";
import { IGenesis } from "./genesisTypes";

export async function getGenesis(): Promise<IGenesis> {
  const ext = path.extname(activeChain.genesisFileUrl);
  const filename = path.basename(activeChain.genesisFileUrl);

  let genesisLocalPath = dataFolderPath + "/" + filename;

  if (!fs.existsSync(genesisLocalPath)) {
    console.log("Downloading genesis file: " + activeChain.genesisFileUrl);
    await download(activeChain.genesisFileUrl, genesisLocalPath);
  }

  if (ext === ".gz") {
    console.log("Extracting genesis file...");
    const decompressed = await ungzip(fs.readFileSync(genesisLocalPath).buffer);
    genesisLocalPath = genesisLocalPath.replace(".gz", "");
    fs.writeFileSync(genesisLocalPath, decompressed);
  }

  const fileContent = await fs.promises.readFile(genesisLocalPath, { encoding: "utf-8" });
  return JSON.parse(fileContent) as IGenesis;
}
