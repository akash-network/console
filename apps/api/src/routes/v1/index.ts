import address from "./addresses/address";
import addressTransactions from "./addresses/transactions";
import nodesMainnet from "./nodes/mainnet";
import nodesSandbox from "./nodes/sandbox";
import nodesTestnet from "./nodes/testnet";
import proposalById from "./proposals/byId";
import proposals from "./proposals/list";
import templateById from "./templates/byId";
import templateList from "./templates/list";
import templateListFull from "./templates/list-full";
import versionMainnet from "./version/mainnet";
import versionSandbox from "./version/sandbox";
import versionTestnet from "./version/testnet";
import gpu from "./gpu";
import gpuBreakdown from "./gpuBreakdown";
import gpuModels from "./gpuModels";
import gpuPrices from "./gpuPrices";
import trialProviders from "./trialProviders";

export default [
  address,
  addressTransactions,
  proposals,
  proposalById,
  templateListFull,
  templateList,
  templateById,
  nodesMainnet,
  nodesSandbox,
  nodesTestnet,
  versionMainnet,
  versionSandbox,
  versionTestnet,
  trialProviders,
  gpu,
  gpuModels,
  gpuPrices,
  gpuBreakdown
];
