import predictedBlockDate from "./predictedBlockDate";
import predictedDateHeight from "./predictedDateHeight";
import transactions from "./transactions/list";
import transactionByHash from "./transactions/byHash";
import address from "./addresses/address";
import addressTransactions from "./addresses/transactions";
import addressDeployments from "./addresses/deployments";
import providerByAddress from "./providers/byAddress";
import providerDeployments from "./providers/deployments";
import providerList from "./providers/list";
import providerAttributesSchema from "./providerAttributesSchema";
import validators from "./validators/list";
import validatorByAddress from "./validators/byAddress";
import proposals from "./proposals/list";
import proposalById from "./proposals/byId";
import templates from "./templates";
import networkCapacity from "./networkCapacity";
import marketData from "./marketData";
import dashboardData from "./dashboardData";
import pricing from "./pricing";
import auditors from "./auditors";
import nodesMainnet from "./nodes/mainnet";
import nodesSandbox from "./nodes/sandbox";
import nodesTestnet from "./nodes/testnet";
import versionMainnet from "./version/mainnet";
import versionSandbox from "./version/sandbox";
import versionTestnet from "./version/testnet";
import deploymentByOwnerDseq from "./deployments/byOwnerDseq";

export default [
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
  validators,
  validatorByAddress,
  proposals,
  proposalById,
  templates,
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
  deploymentByOwnerDseq
];
