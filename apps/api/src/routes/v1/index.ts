import address from "./addresses/address";
import addressTransactions from "./addresses/transactions";
import deploymentByOwnerDseq from "./deployments/byOwnerDseq";
import nodesMainnet from "./nodes/mainnet";
import nodesSandbox from "./nodes/sandbox";
import nodesTestnet from "./nodes/testnet";
import proposalById from "./proposals/byId";
import proposals from "./proposals/list";
import templateById from "./templates/byId";
import templateList from "./templates/list";
import templateListFull from "./templates/list-full";
import validatorByAddress from "./validators/byAddress";
import validators from "./validators/list";
import versionMainnet from "./version/mainnet";
import versionSandbox from "./version/sandbox";
import versionTestnet from "./version/testnet";
import gpu from "./gpu";
import gpuBreakdown from "./gpuBreakdown";
import gpuModels from "./gpuModels";
import gpuPrices from "./gpuPrices";
import leasesDuration from "./leasesDuration";
import marketData from "./marketData";
import predictedBlockDate from "./predictedBlockDate";
import predictedDateHeight from "./predictedDateHeight";
import pricing from "./pricing";
import trialProviders from "./trialProviders";

export default [
  predictedBlockDate,
  predictedDateHeight,
  address,
  addressTransactions,
  validators,
  validatorByAddress,
  proposals,
  proposalById,
  templateListFull,
  templateList,
  templateById,
  marketData,
  pricing,
  nodesMainnet,
  nodesSandbox,
  nodesTestnet,
  versionMainnet,
  versionSandbox,
  versionTestnet,
  deploymentByOwnerDseq,
  trialProviders,
  leasesDuration,
  gpu,
  gpuModels,
  gpuPrices,
  gpuBreakdown
];
