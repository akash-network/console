import address from "./addresses/address";
import addressDeployments from "./addresses/deployments";
import addressTransactions from "./addresses/transactions";
import blockByHeight from "./blocks/byHeight";
import blocks from "./blocks/list";
import deploymentByOwnerDseq from "./deployments/byOwnerDseq";
import nodesMainnet from "./nodes/mainnet";
import nodesSandbox from "./nodes/sandbox";
import nodesTestnet from "./nodes/testnet";
import proposalById from "./proposals/byId";
import proposals from "./proposals/list";
import providerByAddress from "./providers/byAddress";
import providerDeployments from "./providers/deployments";
import providerList from "./providers/list";
import transactionByHash from "./transactions/byHash";
import transactions from "./transactions/list";
import validatorByAddress from "./validators/byAddress";
import validators from "./validators/list";
import versionMainnet from "./version/mainnet";
import versionSandbox from "./version/sandbox";
import versionTestnet from "./version/testnet";
import auditors from "./auditors";
import dashboardData from "./dashboardData";
import graphData from "./graphData";
import marketData from "./marketData";
import networkCapacity from "./networkCapacity";
import predictedBlockDate from "./predictedBlockDate";
import predictedDateHeight from "./predictedDateHeight";
import pricing from "./pricing";
import providerActiveLeasesGraphData from "./providerActiveLeasesGraphData";
import providerAttributesSchema from "./providerAttributesSchema";
import providerGraphData from "./providerGraphData";
import providerRegions from "./providerRegions";
import templateList from "./templates/list";
import templateById from "./templates/byId";
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
  addressDeployments,
  providerByAddress,
  providerList,
  providerDeployments,
  providerAttributesSchema,
  providerRegions,
  validators,
  validatorByAddress,
  proposals,
  proposalById,
  templateList,
  templateById,
  networkCapacity,
  marketData,
  dashboardData,
  pricing,
  auditors,
  nodesMainnet,
  nodesSandbox,
  nodesTestnet,
  versionMainnet,
  versionSandbox,
  versionTestnet,
  deploymentByOwnerDseq,
  providerGraphData,
  graphData,
  providerActiveLeasesGraphData,
  trialProviders
];
