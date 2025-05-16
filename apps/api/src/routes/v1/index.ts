import address from "./addresses/address";
import addressTransactions from "./addresses/transactions";
import blockByHeight from "./blocks/byHeight";
import blocks from "./blocks/list";
import deploymentByOwnerDseq from "./deployments/byOwnerDseq";
import nodesMainnet from "./nodes/mainnet";
import nodesSandbox from "./nodes/sandbox";
import nodesTestnet from "./nodes/testnet";
import proposalById from "./proposals/byId";
import proposals from "./proposals/list";
import providerDeployments from "./providers/deployments";
import templateById from "./templates/byId";
import templateList from "./templates/list";
import templateListFull from "./templates/list-full";
import transactionByHash from "./transactions/byHash";
import transactions from "./transactions/list";
import validatorByAddress from "./validators/byAddress";
import validators from "./validators/list";
import versionMainnet from "./version/mainnet";
import versionSandbox from "./version/sandbox";
import versionTestnet from "./version/testnet";
import dashboardData from "./dashboardData";
import gpu from "./gpu";
import gpuBreakdown from "./gpuBreakdown";
import gpuModels from "./gpuModels";
import gpuPrices from "./gpuPrices";
import graphData from "./graphData";
import leasesDuration from "./leasesDuration";
import marketData from "./marketData";
import networkCapacity from "./networkCapacity";
import predictedBlockDate from "./predictedBlockDate";
import predictedDateHeight from "./predictedDateHeight";
import pricing from "./pricing";
import trialProviders from "./trialProviders";

export default [
  blocks,
  blockByHeight,
  predictedBlockDate,
  predictedDateHeight,
  transactions,
  transactionByHash,
  address,
  addressTransactions,
  providerDeployments,
  validators,
  validatorByAddress,
  proposals,
  proposalById,
  templateListFull,
  templateList,
  templateById,
  networkCapacity,
  marketData,
  dashboardData,
  pricing,
  nodesMainnet,
  nodesSandbox,
  nodesTestnet,
  versionMainnet,
  versionSandbox,
  versionTestnet,
  deploymentByOwnerDseq,
  graphData,
  trialProviders,
  leasesDuration,
  gpu,
  gpuModels,
  gpuPrices,
  gpuBreakdown
];
