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
import validators from "./validators/list";
import validatorByAddress from "./validators/byAddress";
import proposals from "./proposals/list";
import proposalById from "./proposals/byId";
import templates from "./templates";
import networkCapacity from "./networkCapacity";

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
  validators,
  validatorByAddress,
  proposals,
  proposalById,
  templates,
  networkCapacity
];
